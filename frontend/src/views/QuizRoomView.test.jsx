import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import QuizRoomView from './QuizRoomView';
import { resetSharedAudioForTests } from '../utils/audioUnlock';

const onStateCallbacks = [];
const onBuzzCallbacks = [];
const onPointsCallbacks = [];
const onNameErrorCallbacks = [];
let mockConnectionStatus = 'connected';
const setParticipantNameMock = vi.fn();
const buzzMock = vi.fn();

vi.mock('../hooks/useQuizRoomSync', () => ({
  useQuizRoomSync: ({ onState, onBuzz, onPoints, onNameError }) => {
    onStateCallbacks.push(onState);
    onBuzzCallbacks.push(onBuzz);
    onPointsCallbacks.push(onPoints);
    onNameErrorCallbacks.push(onNameError);
    return {
      connectionStatus: mockConnectionStatus,
      broadcastState: vi.fn(),
      setParticipantName: setParticipantNameMock,
      buzz: buzzMock,
    };
  },
}));

const WS_BASE_URL = 'wss://ws.example.com';

function emitState(state) {
  act(() => {
    onStateCallbacks[onStateCallbacks.length - 1]?.(state);
  });
}

function emitBuzz(buzz) {
  act(() => {
    onBuzzCallbacks[onBuzzCallbacks.length - 1]?.(buzz);
  });
}

function emitPoints(points) {
  act(() => {
    onPointsCallbacks[onPointsCallbacks.length - 1]?.(points);
  });
}

function emitNameError(message) {
  act(() => {
    onNameErrorCallbacks[onNameErrorCallbacks.length - 1]?.(message);
  });
}

// 早押し機能（issue #510）: 参加者画面は名前入力を先に確定させないと通常画面へ進まないため、
// 名前を関係しないテストではこのヘルパーで確定させておく
function confirmName(name = 'たろう') {
  fireEvent.change(screen.getByPlaceholderText('お名前'), { target: { value: name } });
  fireEvent.click(screen.getByText('決定'));
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
  onBuzzCallbacks.length = 0;
  onPointsCallbacks.length = 0;
  onNameErrorCallbacks.length = 0;
  mockConnectionStatus = 'connected';
  setParticipantNameMock.mockClear();
  buzzMock.mockClear();
  fetch.mockReset();
  audioInstances.length = 0;
  audioPlayImpl = () => Promise.resolve();
  localStorage.clear();
  // 共有<audio>要素（issue #514）はモジュールスコープのシングルトンなので、
  // テスト間で使い回されないようリセットする
  resetSharedAudioForTests();
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

  it('lets a participant join via a manually entered room code, after confirming a name', () => {
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    expect(screen.getByText('クイズ大会に参加する')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('ルームコード'), { target: { value: 'xyz789' } });
    fireEvent.click(screen.getByText('参加する'));

    confirmName('たろう');

    expect(screen.getByText('クイズ大会モード（参加者）')).toBeInTheDocument();
    expect(screen.getByText('ルーム: XYZ789')).toBeInTheDocument();
    expect(setParticipantNameMock).toHaveBeenCalledWith('たろう');
  });

  it('renders the participant view from a ?roomId= deep link and updates as state is broadcast', () => {
    window.history.pushState({}, '', '?view=quiz-room&roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName();

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
    confirmName();

    emitState({});

    expect(screen.getByText('ホストの操作を待っています...')).toBeInTheDocument();
  });

  it('shows the connection status label to the participant', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    mockConnectionStatus = 'error';

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName();

    expect(screen.getByText('接続状態: 接続できませんでした')).toBeInTheDocument();
  });

  it('lets a participant leave the room and go back to the normal game view', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    const setView = vi.fn();

    render(<QuizRoomView setView={setView} wsBaseUrl={WS_BASE_URL} />);
    fireEvent.click(screen.getByText('← 戻る'));

    expect(setView).toHaveBeenCalledWith('game');
  });

  it('shows a name entry screen before the participant screen, and does not let the participant confirm an empty name (issue #510)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    expect(screen.getByText('早押し対決で使うお名前を入力してください')).toBeInTheDocument();
    expect(screen.queryByText('クイズ大会モード（参加者）', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.queryByText('ルーム:', { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText('決定')).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('お名前'), { target: { value: '   ' } });
    expect(screen.getByText('決定')).toBeDisabled();

    confirmName('はなこ');
    expect(screen.getByText('ルーム: ABC123')).toBeInTheDocument();
    expect(setParticipantNameMock).toHaveBeenCalledWith('はなこ');
  });

  it('lets a participant buzz in while a phrase is being read, and shows the responder\'s name once someone has buzzed (issue #510)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName();

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });
    expect(screen.getByText('回答する')).toBeInTheDocument();

    fireEvent.click(screen.getByText('回答する'));
    expect(buzzMock).toHaveBeenCalled();

    emitBuzz({ name: 'はなこ', connectionId: 'conn-2' });
    expect(screen.getByText('🔔 はなこ さんが回答しました')).toBeInTheDocument();
    expect(screen.queryByText('回答する')).not.toBeInTheDocument();
  });

  it('shows the participant their own accumulated points as "points" messages arrive, keyed by their confirmed name (issue #519)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName('はなこ');

    expect(screen.getByText('獲得ポイント: 0')).toBeInTheDocument();

    emitPoints({ はなこ: 2, たろう: 5 });
    expect(screen.getByText('獲得ポイント: 2')).toBeInTheDocument();
  });

  it('sends the participant back to the name entry screen with an error when the server rejects a duplicate name (issue #519)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName('はなこ');
    expect(screen.getByText('クイズ大会モード（参加者）')).toBeInTheDocument();
    expect(screen.getByText('ルーム: ABC123')).toBeInTheDocument();

    emitNameError('その名前は既に使われています。別の名前を入力してください。');

    expect(screen.getByText('その名前は既に使われています。別の名前を入力してください。')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('お名前')).toBeInTheDocument();
  });

  it('keeps showing the responder during the result screen, but resets it once a new (different) phrase is broadcast', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName();

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });
    emitBuzz({ name: 'はなこ', connectionId: 'conn-2' });
    expect(screen.getByText('🔔 はなこ さんが回答しました')).toBeInTheDocument();

    emitState({ type: 'result', content: { time: 1.2, answer: '答え1' } });
    expect(screen.getByText('🔔 はなこ さんが回答しました')).toBeInTheDocument();

    emitState({ type: 'phrase', content: { id: 'p2', category: 'Cat1', phrase: '読み札2', level: '3' } });
    expect(screen.queryByText('🔔 はなこ さんが回答しました')).not.toBeInTheDocument();
    expect(screen.getByText('回答する')).toBeInTheDocument();
  });

  it('resets the responder display when the room goes back to the initial/idle state (e.g. the admin resets the game), not just when a new phrase is broadcast', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName();

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });
    emitBuzz({ name: 'はなこ', connectionId: 'conn-2' });
    expect(screen.getByText('🔔 はなこ さんが回答しました')).toBeInTheDocument();

    emitState({ type: 'initial' });
    expect(screen.queryByText('🔔 はなこ さんが回答しました')).not.toBeInTheDocument();
  });

  it('does not clear an already-recorded responder when the same phrase is re-broadcast (e.g. the admin changed a setting mid-round)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName();

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3', speechRate: '80%' } });
    emitBuzz({ name: 'はなこ', connectionId: 'conn-2' });
    expect(screen.getByText('🔔 はなこ さんが回答しました')).toBeInTheDocument();

    // 同じ札（id/categoryが同一）が設定変更等で再ブロードキャストされても、
    // 既に記録済みの回答者表示を誤って消してはならない
    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3', speechRate: '100%' } });
    expect(screen.getByText('🔔 はなこ さんが回答しました')).toBeInTheDocument();
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

  it('stops the still-playing previous phrase audio when the next phrase arrives, to avoid overlapping playback (issue #514: reuses the same unlocked <audio> element rather than creating a new one)', async () => {
    fetch.mockImplementation(async (url) => {
      const audioData = url.includes('id=p2') ? 'data:audio/mp3;base64,DUMMY2' : 'data:audio/mp3;base64,DUMMY1';
      return { ok: true, json: async () => ({ audioData }) };
    });
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].src).toBe('data:audio/mp3;base64,DUMMY1');

    emitState({ type: 'phrase', content: { id: 'p2', category: 'Cat1', phrase: '読み札2', level: '3' } });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // 新しいAudioインスタンスを作るのではなく、同じ（ユーザー操作で解錠済みの）要素を
    // 使い回すことで、非同期文脈からの再生でもSafari等でブロックされないようにしている
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(audioInstances[0].src).toBe('data:audio/mp3;base64,DUMMY2');
  });

  it('does not show any manual "turn audio on" button, since audio playback is always on by default (issue #497)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    expect(screen.queryByText('🔊 音声ON')).not.toBeInTheDocument();
    expect(screen.queryByText('🔇 音声OFF')).not.toBeInTheDocument();
  });

  it('does not show a "tap to enable audio" button even when playback is blocked by the autoplay policy (issue #497)', async () => {
    audioPlayImpl = () => Promise.reject(new Error('NotAllowedError'));
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ audioData: 'data:audio/mp3;base64,DUMMY' }) });
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(audioInstances).toHaveLength(1);
    expect(screen.queryByText('🔊 タップして音声を有効にする')).not.toBeInTheDocument();
    expect(screen.queryByText('🔊 音声ON')).not.toBeInTheDocument();
  });

  it('unlocks audio playback (plays a silent clip) the first time the participant clicks or taps anywhere on the screen, as a fallback for deep-link visitors with no join click', () => {
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    expect(audioInstances).toHaveLength(0);

    fireEvent.click(document.body);

    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].play).toHaveBeenCalled();
  });

  it('unlocks audio playback when a participant joins via the manually entered room code button', () => {
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    fireEvent.change(screen.getByPlaceholderText('ルームコード'), { target: { value: 'xyz789' } });
    fireEvent.click(screen.getByText('参加する'));

    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].play).toHaveBeenCalled();
  });
});
