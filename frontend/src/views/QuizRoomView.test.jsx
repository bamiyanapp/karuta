import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import QuizRoomView from './QuizRoomView';
import { resetSharedAudioForTests } from '../utils/audioUnlock';

const onStateCallbacks = [];
const onBuzzCallbacks = [];
const onPointsCallbacks = [];
const onNameErrorCallbacks = [];
const onRoundResetCallbacks = [];
const onParticipantsCallbacks = [];
let mockConnectionStatus = 'connected';
const setParticipantNameMock = vi.fn();
const buzzMock = vi.fn();

vi.mock('../hooks/useQuizRoomSync', () => ({
  useQuizRoomSync: ({ onState, onBuzz, onPoints, onNameError, onRoundReset, onParticipants }) => {
    onStateCallbacks.push(onState);
    onBuzzCallbacks.push(onBuzz);
    onPointsCallbacks.push(onPoints);
    onNameErrorCallbacks.push(onNameError);
    onRoundResetCallbacks.push(onRoundReset);
    onParticipantsCallbacks.push(onParticipants);
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

function emitRoundReset(payload) {
  act(() => {
    onRoundResetCallbacks[onRoundResetCallbacks.length - 1]?.(payload);
  });
}

function emitParticipants(names) {
  act(() => {
    onParticipantsCallbacks[onParticipantsCallbacks.length - 1]?.(names);
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
  onRoundResetCallbacks.length = 0;
  onParticipantsCallbacks.length = 0;
  mockConnectionStatus = 'connected';
  setParticipantNameMock.mockClear();
  buzzMock.mockClear();
  fetch.mockReset();
  // 個別のテストが/get-phrase等を明示的にモックしなかった場合のデフォルト応答。
  // 未設定のままだとfetch()がundefinedを返し、レスポンスのプロパティアクセスで
  // 無用なTypeErrorがログに出てしまう（本番のfetch()はResponseかrejectのいずれかで、
  // undefinedを返すことはないため、これはテスト側の既定値の問題）
  fetch.mockResolvedValue({ ok: false });
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

  it('removes the roomId query param when leaving via "戻る", so a later generic join attempt shows the room-code entry screen instead of re-entering the previous room (issue #532)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');

    const { unmount } = render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    // 名前入力画面（joinRoomIdが設定されている状態）から「戻る」で離脱する
    fireEvent.click(screen.getByText('← 戻る'));

    expect(new URLSearchParams(window.location.search).has('roomId')).toBe(false);

    // アプリ内遷移を模して再マウントする（App.jsxの「クイズ大会に参加する」リンクは
    // roomIdを指定せずQuizRoomViewを再マウントする）。残留roomIdが無いため、
    // 以前のルームへ直接入室する画面ではなくルームコード入力画面が表示されるべき
    unmount();
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);

    expect(screen.getByText('クイズ大会に参加する')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ルームコード')).toBeInTheDocument();
  });

  it('preserves other query params when removing roomId on leaving via "戻る"', () => {
    window.history.pushState({}, '', '?roomId=ABC123&foo=bar');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    fireEvent.click(screen.getByText('← 戻る'));

    const params = new URLSearchParams(window.location.search);
    expect(params.has('roomId')).toBe(false);
    expect(params.get('foo')).toBe('bar');
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
    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();
    expect(screen.queryByText('回答する')).not.toBeInTheDocument();
  });

  it('hides the buzz button immediately on click, before the server broadcast arrives, so it cannot be pressed again in the meantime (issue #588)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName('たろう');

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });
    fireEvent.click(screen.getByText('回答する'));

    // サーバーからのbuzzブロードキャストがまだ届いていない時点でも、
    // 自分自身の押下は即座に反映され、ボタンは既に非表示になっている
    expect(screen.getByText('🔔 たろう さんが回答中')).toBeInTheDocument();
    expect(screen.queryByText('回答する')).not.toBeInTheDocument();

    // 後から届くブロードキャストが、実際の勝者（別の参加者だった場合を含む）で
    // 正しく上書きする
    emitBuzz({ name: 'はなこ', connectionId: 'conn-2' });
    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();
  });

  it('lets other participants buzz in again after a roundReset (incorrect judgment), but not the participant who was judged incorrect (issue #546)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName('はなこ');

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });
    fireEvent.click(screen.getByText('回答する'));
    emitBuzz({ name: 'はなこ', connectionId: 'conn-2' });
    expect(screen.queryByText('回答する')).not.toBeInTheDocument();

    emitRoundReset({ excludedName: 'はなこ' });

    // 不正解と判定された本人は、そのラウンド中は早押しボタンが再表示されない
    expect(screen.queryByText('回答する')).not.toBeInTheDocument();
  });

  it('shows the buzz button again for a participant not excluded after a roundReset (issue #546)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName('はなこ');

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });
    emitBuzz({ name: 'たろう', connectionId: 'conn-2' });
    expect(screen.queryByText('回答する')).not.toBeInTheDocument();

    emitRoundReset({ excludedName: 'たろう' });

    expect(screen.getByText('回答する')).toBeInTheDocument();
  });

  it('re-allows buzzing once a genuinely new round starts, even for a participant excluded in the previous round (issue #546)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName('はなこ');

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });
    fireEvent.click(screen.getByText('回答する'));
    emitBuzz({ name: 'はなこ', connectionId: 'conn-2' });
    emitRoundReset({ excludedName: 'はなこ' });
    expect(screen.queryByText('回答する')).not.toBeInTheDocument();

    emitState({ type: 'phrase', content: { id: 'p2', category: 'Cat1', phrase: '読み札2', level: '3' } });

    expect(screen.getByText('回答する')).toBeInTheDocument();
  });

  it('shows the participant their own accumulated points as "points" messages arrive, keyed by their confirmed name (issue #519)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName('はなこ');

    expect(screen.getByText('獲得ポイント: 0')).toBeInTheDocument();

    emitPoints({ はなこ: 2, たろう: 5 });
    expect(screen.getByText('獲得ポイント: 2')).toBeInTheDocument();
  });

  it('shows a combined participant list (including 0pt participants), highlighting the confirmed participant\'s own name (issue #545)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName('はなこ');

    emitParticipants(['はなこ', 'たろう', 'じろう']);
    emitPoints({ たろう: 5 });

    expect(screen.getByText('参加者一覧')).toBeInTheDocument();
    const points = screen.getAllByText(/pt$/).map((el) => el.textContent);
    expect(points).toEqual(['たろう: 5pt', 'じろう: 0pt', 'はなこ: 0pt']);

    const ownEntry = screen.getByText('はなこ', { selector: 'span.fw-bold' });
    expect(ownEntry).toBeInTheDocument();
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
    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();

    emitState({ type: 'result', content: { time: 1.2, answer: '答え1' } });
    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();

    emitState({ type: 'phrase', content: { id: 'p2', category: 'Cat1', phrase: '読み札2', level: '3' } });
    expect(screen.queryByText('🔔 はなこ さんが回答中')).not.toBeInTheDocument();
    expect(screen.getByText('回答する')).toBeInTheDocument();
  });

  it('resets the responder display when the room goes back to the initial/idle state (e.g. the admin resets the game), not just when a new phrase is broadcast', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName();

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });
    emitBuzz({ name: 'はなこ', connectionId: 'conn-2' });
    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();

    emitState({ type: 'initial' });
    expect(screen.queryByText('🔔 はなこ さんが回答中')).not.toBeInTheDocument();
  });

  it('does not clear an already-recorded responder when the same phrase is re-broadcast (e.g. the admin changed a setting mid-round)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName();

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3', speechRate: '80%' } });
    emitBuzz({ name: 'はなこ', connectionId: 'conn-2' });
    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();

    // 同じ札（id/categoryが同一）が設定変更等で再ブロードキャストされても、
    // 既に記録済みの回答者表示を誤って消してはならない
    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3', speechRate: '100%' } });
    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();
  });

  it('accumulates broadcast phrases into a collapsed-by-default local history, newest first, without duplicating a re-broadcast of the same phrase (issue #548)', () => {
    window.history.pushState({}, '', '?roomId=ABC123');
    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    confirmName();

    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });

    // 履歴一覧はデフォルトで折りたたまれている
    expect(screen.queryByText('読み札1', { selector: '.list-group-item .text-dark' })).not.toBeInTheDocument();
    expect(screen.getByText('これまでに読み上げた札を表示する（1枚）')).toBeInTheDocument();

    // 同じ札の再ブロードキャスト（設定変更等）では重複追加されない
    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3', speechRate: '100%' } });
    expect(screen.getByText('これまでに読み上げた札を表示する（1枚）')).toBeInTheDocument();

    emitState({ type: 'result', content: { time: 1.2, answer: '答え1' } });
    emitState({ type: 'phrase', content: { id: 'p2', category: 'Cat1', phrase: '読み札2', level: '3' } });

    fireEvent.click(screen.getByText('これまでに読み上げた札を表示する（2枚）'));

    const items = screen.getAllByText(/^読み札/, { selector: '.list-group-item .text-dark' });
    expect(items.map((el) => el.textContent)).toEqual(['読み札2', '読み札1']);

    fireEvent.click(screen.getByText('これまでに読み上げた札を閉じる'));
    expect(screen.queryByText('読み札1', { selector: '.list-group-item .text-dark' })).not.toBeInTheDocument();
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
    confirmName();

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
    confirmName();

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
    confirmName();

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

  it('does not play audio for a phrase that was already in progress when joining, while still on the name entry screen, and does not play it retroactively once the name is confirmed (issue #530)', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ audioData: 'data:audio/mp3;base64,DUMMY' }) });
    window.history.pushState({}, '', '?roomId=ABC123');

    render(<QuizRoomView setView={vi.fn()} wsBaseUrl={WS_BASE_URL} />);
    // まだ名前を確定していない（名前入力画面のまま）
    expect(screen.getByPlaceholderText('お名前')).toBeInTheDocument();

    // 入室時点で既にホストが札を読み上げ中だったケース
    emitState({ type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(audioInstances).toHaveLength(0);

    // 名前を確定しても、確定前から進行中だった同じラウンドの音声が遡って
    // 再生されることはない（「次の札」からの再生という要望どおりの挙動）。
    // 「決定」ボタンのクリック自体が共有<audio>要素の解錠（issue #497/#514）を
    // 引き起こすため、audioInstancesは1件になるが、フレーズの取得（fetch）は
    // 行われておらず、再生される音声も無音の解錠用データのままであることを確認する
    confirmName();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].src).toBe('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');

    // 名前確定後に届いた次の札からは通常どおり再生される（同じ共有要素のsrcが
    // 差し替わる。issue #514）
    emitState({ type: 'phrase', content: { id: 'p2', category: 'Cat1', phrase: '読み札2', level: '3' } });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].src).toBe('data:audio/mp3;base64,DUMMY');
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
    confirmName();

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
