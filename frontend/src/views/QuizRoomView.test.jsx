import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import QuizRoomView from './QuizRoomView';

const onStateCallbacks = [];
let mockConnectionStatus = 'connected';

vi.mock('../hooks/useQuizRoomSync', () => ({
  useQuizRoomSync: ({ onState }) => {
    onStateCallbacks.push(onState);
    return { connectionStatus: mockConnectionStatus, broadcastState: vi.fn() };
  },
}));

const API_BASE_URL = 'https://api.example.com';
const WS_BASE_URL = 'wss://ws.example.com';

function emitState(state) {
  act(() => {
    onStateCallbacks[onStateCallbacks.length - 1]?.(state);
  });
}

beforeEach(() => {
  onStateCallbacks.length = 0;
  mockConnectionStatus = 'connected';
  window.fetch = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  window.history.pushState({}, '', '/');
  vi.restoreAllMocks();
});

describe('QuizRoomView', () => {
  it('shows a preparing message and no room UI when wsBaseUrl is not configured', () => {
    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={null} onRoomCreated={vi.fn()} />);
    expect(screen.getByText('クイズ大会モードは現在準備中です。しばらくお待ちください。')).toBeInTheDocument();
  });

  it('creates a room, hands roomId/adminToken up to the parent, and switches to the normal game view', async () => {
    window.fetch.mockResolvedValue({ ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) });
    const onRoomCreated = vi.fn();
    const setView = vi.fn();

    render(<QuizRoomView setView={setView} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} onRoomCreated={onRoomCreated} />);
    fireEvent.click(screen.getByText('管理者としてルームを開設する'));

    await vi.waitFor(() => expect(onRoomCreated).toHaveBeenCalledWith({ roomId: 'ABC123', adminToken: 'token-1' }));
    expect(setView).toHaveBeenCalledWith('game');
  });

  it('shows a create-room error and does not transition when creation fails', async () => {
    window.fetch.mockResolvedValue({ ok: false });
    const onRoomCreated = vi.fn();
    const setView = vi.fn();

    render(<QuizRoomView setView={setView} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} onRoomCreated={onRoomCreated} />);
    fireEvent.click(screen.getByText('管理者としてルームを開設する'));

    expect(await screen.findByText('ルームの作成に失敗しました。もう一度お試しください。')).toBeInTheDocument();
    expect(onRoomCreated).not.toHaveBeenCalled();
    expect(setView).not.toHaveBeenCalled();
  });

  it('lets a participant join via a manually entered room code', () => {
    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} onRoomCreated={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('ルームコード'), { target: { value: 'xyz789' } });
    fireEvent.click(screen.getByText('参加する'));

    expect(screen.getByText('クイズ大会モード（参加者）')).toBeInTheDocument();
    expect(screen.getByText('ルーム: XYZ789')).toBeInTheDocument();
  });

  it('renders the participant view from a ?roomId= deep link and updates as state is broadcast', () => {
    window.history.pushState({}, '', '?view=quiz-room&roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} onRoomCreated={vi.fn()} />);

    expect(screen.getByText('クイズ大会モード（参加者）')).toBeInTheDocument();
    expect(screen.getByText('ホストの操作を待っています...')).toBeInTheDocument();

    emitState({ type: 'initial' });
    expect(screen.getByText('ホストの操作を待っています...')).toBeInTheDocument();

    emitState({ type: 'phrase', content: { category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '3' } });
    expect(screen.getByText('読み札1')).toBeInTheDocument();
    expect(screen.getByText('レベル: 3')).toBeInTheDocument();

    emitState({ type: 'result', content: { time: 1.234, answer: '答え1' } });
    expect(screen.getByText('1.23')).toBeInTheDocument();
    expect(screen.getByText('答え1')).toBeInTheDocument();
  });

  it('shows the connection status label to the participant', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    mockConnectionStatus = 'error';

    render(<QuizRoomView setView={vi.fn()} apiBaseUrl={API_BASE_URL} wsBaseUrl={WS_BASE_URL} onRoomCreated={vi.fn()} />);

    expect(screen.getByText('接続状態: 接続できませんでした')).toBeInTheDocument();
  });
});
