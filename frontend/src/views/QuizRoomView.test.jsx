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

window.fetch = vi.fn();

const audioInstances = [];
let audioPlayImpl = () => Promise.resolve();

// App.test.jsxと同様の理由でアロー関数ではなく通常の関数式を使う（newで呼び出すため）
window.Audio = vi.fn().mockImplementation(function (src) {
  this.src = src;
  this.play = vi.fn(() => audioPlayImpl());
  this.pause = vi.fn();
  audioInstances.push(this);
});

beforeEach(() => {
  onStateCallbacks.length = 0;
  mockConnectionStatus = 'connected';
  fetch.mockReset();
  audioInstances.length = 0;
  audioPlayImpl = () => Promise.resolve();
  localStorage.clear();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
  // restoreAllMocksだとwindow.Audio/window.fetchに設定したmockImplementationも
  // 消えてしまう（モック自体は一度きりの生成のため）ので、呼び出し履歴だけを消すclearを使う
  vi.clearAllMocks();
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

  it('lets a participant leave the room and go back to the normal game view', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    const setView = vi.fn();

    render(<QuizRoomView setView={setView} wsBaseUrl={WS_BASE_URL} />);
    fireEvent.click(screen.getByText('← 戻る'));

    expect(setView).toHaveBeenCalledWith('game');
  });

  it('fetches and plays audio for a broadcast phrase using the settings broadcast by the admin, not the participant\'s own local settings (issue #490, #498)', async () => {
    // 参加者自身のローカル設定は無視され、管理者からブロードキャストされた設定が使われることを
    // 確認するため、参加者側のlocalStorageにはあえて異なる値を入れておく
    localStorage.setItem('repeatCount', '1');
    localStorage.setItem('speechRate', '100%');
    localStorage.setItem('voiceId', 'Kazuha');
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ audioData: 'data:audio/mp3;base64,DUMMY' }),
    });
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    emitState({
      type: 'phrase',
      content: {
        id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '3',
        repeatCount: 3, speechRate: '70%', lang: 'ja', voiceId: 'Takumi', announceCategory: true,
      },
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const requestedUrl = fetch.mock.calls[0][0];
    expect(requestedUrl).toContain('id=p1');
    expect(requestedUrl).toContain('category=Cat1');
    expect(requestedUrl).toContain('repeatCount=3');
    expect(requestedUrl).toContain('speechRate=70%25');
    expect(requestedUrl).toContain('voiceId=Takumi');
    expect(requestedUrl).toContain('announceCategory=true');
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].src).toBe('data:audio/mp3;base64,DUMMY');
    expect(audioInstances[0].play).toHaveBeenCalled();
  });

  it('falls back to sensible defaults when the broadcast phrase content has no playback settings', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ audioData: 'data:audio/mp3;base64,DUMMY' }) });
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '3' } });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const requestedUrl = fetch.mock.calls[0][0];
    expect(requestedUrl).toContain('repeatCount=2');
    expect(requestedUrl).toContain('speechRate=80%25');
    expect(requestedUrl).toContain('lang=ja');
    expect(requestedUrl).toContain('voiceId=Mizuki');
    expect(requestedUrl).toContain('announceCategory=false');
  });

  it('stops the still-playing previous phrase audio when the next phrase arrives, to avoid overlapping playback', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ audioData: 'data:audio/mp3;base64,DUMMY' }) });
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(audioInstances).toHaveLength(1);

    emitState({ type: 'phrase', content: { id: 'p2', category: 'Cat1', phrase: '読み札2', level: '3' } });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[0].pause).toHaveBeenCalled();
  });

  it('does not show any manual "turn audio on" button, since audio playback is always on by default (issue #497)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    expect(screen.queryByText('🔊 音声ON')).not.toBeInTheDocument();
    expect(screen.queryByText('🔇 音声OFF')).not.toBeInTheDocument();
  });

  it('shows a retry button when playback is blocked (autoplay policy), and lets the participant retry with a tap', async () => {
    audioPlayImpl = () => Promise.reject(new Error('NotAllowedError'));
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ audioData: 'data:audio/mp3;base64,DUMMY' }) });
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });

    const retryButton = await screen.findByText('🔊 タップして音声を有効にする');
    expect(audioInstances).toHaveLength(1);

    audioPlayImpl = () => Promise.resolve();
    fireEvent.click(retryButton);

    await act(async () => {
      await Promise.resolve();
    });

    expect(audioInstances).toHaveLength(2);
    expect(audioInstances[1].src).toBe('data:audio/mp3;base64,DUMMY');
    expect(screen.queryByText('🔊 タップして音声を有効にする')).not.toBeInTheDocument();
  });
});
