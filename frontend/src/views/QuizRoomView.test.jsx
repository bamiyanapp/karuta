import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import QuizRoomView from './QuizRoomView';

const onStateCallbacks = [];
const broadcastState = vi.fn();
let mockConnectionStatus = 'connected';

vi.mock('../hooks/useQuizRoomSync', () => ({
  useQuizRoomSync: ({ onState }) => {
    onStateCallbacks.push(onState);
    return { connectionStatus: mockConnectionStatus, broadcastState };
  },
}));

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake') },
}));

const API_BASE_URL = 'https://api.example.com';
const WS_BASE_URL = 'wss://ws.example.com';

function emitState(state, role = 'participant') {
  act(() => {
    onStateCallbacks[onStateCallbacks.length - 1]?.(state, role);
  });
}

beforeEach(() => {
  onStateCallbacks.length = 0;
  broadcastState.mockClear();
  mockConnectionStatus = 'connected';
  // 管理者ロビー画面はマウント時に/get-categoriesを取得するため、個別に上書きしないテストでも
  // fetchが未定義呼び出しで例外にならないよう既定のレスポンスを用意する
  window.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ categories: [] }) });
  // Audioはnew Audio(...)で呼ばれるため、newできないアロー関数実装は使えない
  window.Audio = vi.fn().mockImplementation(function MockAudio() {
    return { play: vi.fn().mockResolvedValue(undefined) };
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  window.history.pushState({}, '', '/');
  vi.restoreAllMocks();
});

describe('QuizRoomView', () => {
  it('shows a preparing message and no room UI when wsBaseUrl is not configured', () => {
    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={null} />);
    expect(screen.getByText('クイズ大会モードは現在準備中です。しばらくお待ちください。')).toBeInTheDocument();
  });

  it('lets the admin create a room, fetch categories, and shows the room code with a QR code', async () => {
    window.fetch.mockImplementation((url) => {
      if (url.includes('/quiz-room')) {
        return Promise.resolve({ ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) });
      }
      if (url.includes('/get-categories')) {
        return Promise.resolve({ ok: true, json: async () => ({ categories: [{ name: 'Cat1' }, { name: 'Cat2' }] }) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} />);

    fireEvent.click(screen.getByText('管理者としてルームを開設する'));

    expect(await screen.findByText('ABC123')).toBeInTheDocument();
    expect(await screen.findByText('Cat1')).toBeInTheDocument();
    expect(await screen.findByAltText('参加用QRコード')).toBeInTheDocument();
  });

  it('disables 開始する while the WebSocket connection is not yet established, to avoid silently dropping the broadcast', async () => {
    mockConnectionStatus = 'connecting';
    window.fetch.mockImplementation((url) => {
      if (url.includes('/quiz-room')) {
        return Promise.resolve({ ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) });
      }
      if (url.includes('/get-categories')) {
        return Promise.resolve({ ok: true, json: async () => ({ categories: [{ name: 'Cat1' }] }) });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} />);
    fireEvent.click(screen.getByText('管理者としてルームを開設する'));
    fireEvent.click(await screen.findByText('Cat1'));

    expect(screen.getByText('開始する')).toBeDisabled();
  });

  it('shows a create-room error and allows retry when room creation fails', async () => {
    window.fetch.mockResolvedValue({ ok: false });

    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} />);
    fireEvent.click(screen.getByText('管理者としてルームを開設する'));

    expect(await screen.findByText('ルームの作成に失敗しました。もう一度お試しください。')).toBeInTheDocument();
  });

  it('runs the full admin flow: select a category, start, and advance to the next phrase', async () => {
    window.fetch.mockImplementation((url) => {
      if (url.includes('/quiz-room')) {
        return Promise.resolve({ ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) });
      }
      if (url.includes('/get-categories')) {
        return Promise.resolve({ ok: true, json: async () => ({ categories: [{ name: 'Cat1' }] }) });
      }
      if (url.includes('/get-phrases-list')) {
        return Promise.resolve({ ok: true, json: async () => ({ phrases: [{ id: 'p1' }] }) });
      }
      if (url.includes('/get-phrase')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'data:audio/mp3;base64,fake' }),
        });
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} />);

    fireEvent.click(screen.getByText('管理者としてルームを開設する'));
    fireEvent.click(await screen.findByText('Cat1'));
    fireEvent.click(screen.getByText('開始する'));

    expect(await screen.findByText('0 / 1 枚')).toBeInTheDocument();
    expect(broadcastState).toHaveBeenCalledWith({ type: 'waiting', categoryLabel: 'Cat1' });

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(broadcastState).toHaveBeenCalledWith({
        type: 'phrase',
        phrase: { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', answer: undefined },
      });
    });
    // 最後の1枚を出したのでfinishedも合わせて配信される
    expect(broadcastState).toHaveBeenCalledWith({ type: 'finished' });
    expect(await screen.findByText('終了しました')).toBeInTheDocument();
    expect(screen.getByText('1 / 1 枚')).toBeInTheDocument();
  });

  it('lets a participant join via a manually entered room code', () => {
    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} />);

    fireEvent.change(screen.getByPlaceholderText('ルームコード'), { target: { value: 'xyz789' } });
    fireEvent.click(screen.getByText('参加する'));

    expect(screen.getByText('クイズ大会モード（参加者）')).toBeInTheDocument();
    expect(screen.getByText('ルーム: XYZ789')).toBeInTheDocument();
  });

  it('renders the participant view from a ?roomId= deep link and updates as state is broadcast', () => {
    window.history.pushState({}, '', '?view=quiz-room&roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} />);

    expect(screen.getByText('クイズ大会モード（参加者）')).toBeInTheDocument();
    expect(screen.getByText('ホストの操作を待っています...')).toBeInTheDocument();

    emitState({ type: 'waiting', categoryLabel: 'Cat1' });
    expect(screen.getByText('まもなく開始します（Cat1）...')).toBeInTheDocument();

    emitState({ type: 'phrase', phrase: { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '3' } });
    expect(screen.getByText('読み札1')).toBeInTheDocument();
    expect(screen.getByText('レベル: 3')).toBeInTheDocument();

    emitState({ type: 'finished' });
    expect(screen.getByText('すべての読み札が終わりました。お疲れ様でした！')).toBeInTheDocument();
  });

  it('shows the connection status label to the participant', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    mockConnectionStatus = 'error';

    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} />);

    expect(screen.getByText('接続状態: 接続できませんでした')).toBeInTheDocument();
  });
});
