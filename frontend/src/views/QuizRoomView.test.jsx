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

const WS_BASE_URL = 'wss://ws.example.com';

function emitState(state) {
  act(() => {
    onStateCallbacks[onStateCallbacks.length - 1]?.(state);
  });
}

beforeEach(() => {
  onStateCallbacks.length = 0;
  mockConnectionStatus = 'connected';
});

afterEach(() => {
  window.history.pushState({}, '', '/');
  vi.restoreAllMocks();
});

describe('QuizRoomView', () => {
  it('shows a preparing message and no room UI when wsBaseUrl is not configured', () => {
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={null} />);
    expect(screen.getByText('クイズ大会モードは現在準備中です。しばらくお待ちください。')).toBeInTheDocument();
  });

  it('lets a participant join via a manually entered room code', () => {
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    expect(screen.getByText('クイズ大会に参加する')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('ルームコード'), { target: { value: 'xyz789' } });
    fireEvent.click(screen.getByText('参加する'));

    expect(screen.getByText('クイズ大会モード（参加者）')).toBeInTheDocument();
    expect(screen.getByText('ルーム: XYZ789')).toBeInTheDocument();
  });

  it('renders the participant view from a ?roomId= deep link and updates as state is broadcast', () => {
    window.history.pushState({}, '', '?view=quiz-room&roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

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

  it('treats an unrecognized or empty room state (e.g. right after room creation, before any card is shown) as "waiting" rather than a blank screen', () => {
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    emitState({});

    expect(screen.getByText('ホストの操作を待っています...')).toBeInTheDocument();
  });

  it('shows the connection status label to the participant', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    mockConnectionStatus = 'error';

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    expect(screen.getByText('接続状態: 接続できませんでした')).toBeInTheDocument();
  });
});
