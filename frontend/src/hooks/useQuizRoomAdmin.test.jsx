import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';
import { resetSharedAudioForTests } from '../utils/audioUnlock';

// クイズ大会モードの管理者側ロジック（useQuizRoomAdmin、issue #607で App.jsx から
// 切り出し）のテスト。useQuizRoomAdminはApp.jsxのstate・表示中の札の状態と密接に
// 結びついているため、renderHookによる単体テストではなく、既存のApp.test.jsxと
// 同様に<App />を実際にレンダーしてUI経由で検証する（分割前と同じテスト内容）。

window.alert = vi.fn();

// Mock fetch
window.fetch = vi.fn();

// Mock Audio（App.test.jsxと同じモック。クイズ大会の管理者はゲーム画面の
// 読み上げ機能とWebSocket接続を同時に使うため、こちらも必要）
window.Audio = vi.fn().mockImplementation(function (url) {
  const audio = {
    play: vi.fn().mockResolvedValue(),
    pause: vi.fn(),
    load: vi.fn(),
    _src: undefined,
    get src() {
      return this._src;
    },
    set src(url) {
      this._src = url;
      setTimeout(() => {
        if (this.oncanplaythrough) this.oncanplaythrough();
        if (this.onended) setTimeout(this.onended, 0);
      }, 0);
    },
  };
  if (url) audio.src = url;
  return audio;
});

window.scrollTo = vi.fn();

// 注意（issue #712）: 各テスト内のMockWebSocketはsend()した内容を記録するのみで、
// サーバー応答（judgeQuizRoomBuzzによる`points`/`roundReset`ブロードキャスト等）は
// 自動生成されない。判定操作（正解/不正解ボタン押下）後の状態反映を検証する場合は、
// judgeAndEcho()を使うか、対応するws.onmessage呼び出しを明示的に追加すること。
// 模擬を書き忘れると「値が反映されない」という誤ったテスト失敗を引き当てる
// （issue #698対応時の実例）。楽観的UI更新（issue #600）の一部の見た目は
// この模擬が無くても正しく動作して見えるため、模擬漏れに気づきにくい点に注意する。
function judgeAndEcho(ws, { correct, name, points, answerCounts }) {
  fireEvent.click(screen.getByText(correct ? '正解' : '不正解'));
  act(() => {
    ws.onmessage?.({
      data: JSON.stringify(
        correct
          ? { type: 'points', points, ...(answerCounts ? { answerCounts } : {}) }
          : { type: 'roundReset', excludedName: name, ...(answerCounts ? { answerCounts } : {}) }
      ),
    });
  });
}

describe('useQuizRoomAdmin (via App)', () => {
  beforeEach(() => {
    fetch.mockClear();
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    sessionStorage.clear();
    // 参加者名の永続化（issue #697）: あるテストで確定した名前が別のテストへ
    // 漏れ、名前入力画面が意図せずスキップされてしまわないようにする
    localStorage.removeItem('quizRoomParticipantName');
    // 管理者セッション復帰（issue #697）: あるテストでルームを作成すると保存される
    // quizRoomAdminSessionが別のテストへ漏れると、読み上げ画面が「再開する」ボタンの
    // 表示に切り替わってしまい（issue #748）、「作成する」ボタンを前提にした他の
    // テストが軒並み壊れるため、テストごとに毎回明示的にクリアする
    localStorage.removeItem('quizRoomAdminSession');
    resetSharedAudioForTests();
  });

  it('places the player-registration button next to the quiz-room button, and hides it once a quiz room has been created (issue #549)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', phrase: '読み札1' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByText(/かるたを始める/));
    await waitFor(() => screen.getByText('次の札'));

    // クイズ大会ルーム作成前は、参加者登録ボタンがルーム作成ボタンと並んで表示される
    expect(screen.getByText('取った人を記録する')).toBeInTheDocument();
    expect(screen.getByText('クイズ大会のルームを作成する')).toBeInTheDocument();

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    // ルーム作成後は参加者登録ボタン自体が非表示になる
    expect(screen.queryByText('取った人を記録する')).not.toBeInTheDocument();
    expect(screen.queryByText('参加者を編集する')).not.toBeInTheDocument();
  });

  it('does not show player registration or the taken-by buttons in kids mode even if players are already registered', async () => {
    sessionStorage.setItem('players', JSON.stringify(['たろう']));

    fetch.mockImplementation(async (url) => {
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1', phrase: '読み札1' }] }) };
      if (url.includes('/get-phrase?')) return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', phrase: '読み札1', audioData: 'dummy' }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));

    await waitFor(() => screen.getByText('次の札'));
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.getByText('読み札1', { selector: '.yomifuda-phrase' })).toBeInTheDocument();
    }, { timeout: 20000 });

    expect(screen.queryByText('取った人:')).not.toBeInTheDocument();
  }, 40000);

  it('lets an admin open a quiz room and view the room info on a dedicated screen without dropping the WebSocket connection, then broadcasts phrase changes after returning (issue #470, #547)', async () => {
    // 読み上げ設定はlocalStorageに永続化されており、他のテストの実行順序に
    // 左右されないよう、ブロードキャスト内容として期待する値を明示的に固定する
    localStorage.setItem('repeatCount', '2');
    localStorage.setItem('speechRate', '80%');
    localStorage.setItem('lang', 'ja');
    localStorage.setItem('voiceId', 'Mizuki');

    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    // クイズ大会モードの入口はトップページから削除済み。管理者は通常のかるた
    // 読み上げ画面まで進み、そのフッターからルームを作成する
    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    expect(MockWebSocket.instances).toHaveLength(1);
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain('roomId=ABC123');
    expect(ws.url).toContain('adminToken=token-1');

    // ルーム情報表示は別画面への遷移になった（issue #547）。通常のゲーム画面からは離れる
    fireEvent.click(screen.getByText('ルーム情報を表示（クイズ大会モード）'));
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.queryByText('次の札')).not.toBeInTheDocument();

    // 「戻る」で通常のゲーム画面に戻る。WebSocket接続はApp自体がview遷移で
    // アンマウントされないため、この間も同じインスタンスのまま維持されている
    fireEvent.click(screen.getByText('← 戻る'));
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument();
    expect(screen.getByText('次の札')).toBeInTheDocument();
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      const phraseBroadcast = ws.sent.find((msg) => msg.includes('"type":"phrase"'));
      expect(phraseBroadcast).toBeDefined();
    }, { timeout: 20000 });

    const payload = JSON.parse(ws.sent.find((msg) => msg.includes('"type":"phrase"')));
    expect(payload).toEqual({
      action: 'updateState',
      state: {
        type: 'phrase',
        content: {
          id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', answer: undefined,
          repeatCount: 2, speechRate: '80%', lang: 'ja', voiceId: 'Mizuki', announceCategory: false,
        },
      },
    });
  }, 40000);

  it('shows the admin a connection warning once the connection is lost, and a reconnect button once retries are exhausted (issue #614)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        this.onopen = null;
        this.onclose = null;
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {
        this.readyState = 3;
      }
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    // ハンドシェイク中（まだonopenが呼ばれていない）は「接続中...」の警告が
    // 出るが、再接続ボタンはまだ出さない（一時的な状態であり、ユーザー操作を
    // 促す必要が無いため）
    expect(screen.getByText(/クイズ大会の接続状態: 接続中/)).toBeInTheDocument();
    expect(screen.queryByText('再接続')).not.toBeInTheDocument();

    // 再接続の待ち時間（3秒間隔）を手動で進めるため、ここでフェイクタイマーへ
    // 切り替える（ここまでのAppの初期表示・ルーム作成は実タイマーのまま行う。
    // shouldAdvanceTime: trueは実時間の経過とfireTimersByTimeの呼び出しが
    // 競合しMockWebSocket.instancesの数え上げがずれることがあったため使わない）
    vi.useFakeTimers();

    // 再接続の上限（5回）まで切断を繰り返し、"error"状態に到達させる
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const instance = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      act(() => {
        instance.readyState = 3;
        instance.onclose?.();
      });
      if (attempt < 5) {
        act(() => {
          vi.advanceTimersByTime(3000);
        });
      }
    }

    expect(screen.getByText(/クイズ大会の接続状態: 接続できませんでした/)).toBeInTheDocument();
    const reconnectButton = screen.getByText('再接続');
    const countBeforeReconnect = MockWebSocket.instances.length;

    fireEvent.click(reconnectButton);

    expect(MockWebSocket.instances).toHaveLength(countBeforeReconnect + 1);
    expect(screen.getByText(/クイズ大会の接続状態: 接続中/)).toBeInTheDocument();

    vi.useRealTimers();
  }, 20000);

  it('shows the responder\'s name to the admin when a participant buzzes in, and resets it once the next card is shown (issue #510)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }, { id: 'p2', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'buzz', name: 'はなこ', connectionId: 'conn-2' }) });
    });

    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();

    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      expect(screen.queryByText('🔔 はなこ さんが回答中')).not.toBeInTheDocument();
    }, { timeout: 20000 });
  }, 40000);

  it('shows a judgment modal with 正解/不正解 buttons when a participant buzzes in, and sends the judgment over the WebSocket while closing the modal (issue #546)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'buzz', name: 'はなこ', connectionId: 'conn-2' }) });
    });

    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();
    expect(screen.getByText('正解')).toBeInTheDocument();
    expect(screen.getByText('不正解')).toBeInTheDocument();

    fireEvent.click(screen.getByText('不正解'));

    expect(ws.sent).toContainEqual(JSON.stringify({ action: 'judgeBuzz', correct: false }));
    expect(screen.queryByText('🔔 はなこ さんが回答中')).not.toBeInTheDocument();
    // issue #613: 不正解の判定結果も音で通知する
    expect(window.Audio.mock.results.map((r) => r.value).some((a) => a.src === 'quiz-incorrect.mp3')).toBe(true);
  }, 40000);

  it('shows the buzz judgment modal even while the admin is on the room info screen (issue #613)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    // issue #613: ルーム情報画面（QuizRoomInfoView）へ遷移すると、以前はearly-return
    // ブランチがモーダルのJSXを含んでいなかったため、この画面を開いている間に参加者が
    // 早押ししても管理者が気づけなかった
    fireEvent.click(screen.getByText('ルーム情報を表示（クイズ大会モード）'));
    expect(screen.getByText('ABC123')).toBeInTheDocument();

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'buzz', name: 'はなこ', connectionId: 'conn-2' }) });
    });

    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();
    // ルーム情報画面自体も表示されたままであることを確認する
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    // issue #613: 早押し発生を管理者側にも音で通知する
    expect(window.Audio.mock.results.map((r) => r.value).some((a) => a.src === 'quiz-buzz.mp3')).toBe(true);

    fireEvent.click(screen.getByText('正解'));
    expect(ws.sent).toContainEqual(JSON.stringify({ action: 'judgeBuzz', correct: true }));
    expect(screen.queryByText('🔔 はなこ さんが回答中')).not.toBeInTheDocument();
    // issue #613: 正誤判定の結果も音で通知する
    expect(window.Audio.mock.results.map((r) => r.value).some((a) => a.src === 'quiz-correct.mp3')).toBe(true);
  }, 40000);

  it('shows the current phrase\'s answer in the judgment modal, so the admin can tell whether the response was correct (issue #586)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', answer: '答え1', explanation: '解説1', audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    // 実際に札を読み上げ、currentPhraseに答えがセットされた状態にしてから早押しを送る
    fireEvent.click(screen.getByText('次の札'));
    await waitFor(() => {
      expect(ws.sent.find((msg) => msg.includes('"type":"phrase"'))).toBeDefined();
    }, { timeout: 20000 });

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'buzz', name: 'はなこ', connectionId: 'conn-2' }) });
    });

    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();
    expect(screen.getByText('答え1')).toBeInTheDocument();
    // issue #693: 判定モーダルにも解説を表示する
    expect(screen.getByText('解説1')).toBeInTheDocument();
  }, 40000);

  it('reveals the result screen (and stops the elapsed-time measurement) as soon as a buzz is judged correct, instead of waiting for the admin to click 次の札, and broadcasts the winner\'s name (issue #600)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', answer: '答え1', audioData: 'dummy' }) };
      }
      if (url.includes('/record-time')) return { ok: true, json: async () => ({}) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    fireEvent.click(screen.getByText('次の札'));
    await waitFor(() => {
      expect(ws.sent.find((msg) => msg.includes('"type":"phrase"'))).toBeDefined();
    }, { timeout: 20000 });

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'buzz', name: 'はなこ', connectionId: 'conn-2' }) });
    });

    fireEvent.click(screen.getByText('正解'));

    expect(ws.sent).toContainEqual(JSON.stringify({ action: 'judgeBuzz', correct: true }));

    // 「次の札」を一切押していないのに、正解判定だけで管理者の画面も
    // 結果画面（答え表示）へ切り替わる
    await waitFor(() => {
      expect(screen.getByText('所要時間')).toBeInTheDocument();
      expect(screen.getByText('答え1')).toBeInTheDocument();
    }, { timeout: 20000 });

    // 参加者側へも、正解者名（winner）を含むresultが即座にブロードキャストされる
    await waitFor(() => {
      const resultMsg = ws.sent.find((msg) => msg.includes('"action":"updateState"') && msg.includes('"type":"result"'));
      expect(resultMsg).toBeDefined();
      expect(JSON.parse(resultMsg).state.content.winner).toBe('はなこ');
    }, { timeout: 20000 });
  }, 40000);

  it('broadcasts isAllRead:true once the selected category\'s last phrase has been read, so the top-page room list can show a "終了" status (issue #501)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      if (url.includes('/record-time')) return { ok: true, json: async () => ({}) };
      if (url.includes('get-congratulation-audio')) return { ok: true, json: async () => ({ audioData: 'dummy' }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    // 1件しかないカテゴリの唯一の札を読み上げる
    fireEvent.click(screen.getByText('次の札'));
    await waitFor(() => {
      expect(ws.sent.find((msg) => msg.includes('"type":"phrase"'))).toBeDefined();
    }, { timeout: 20000 });

    // issue #781: 参加者へのブロードキャストが管理者自身のイントロ音声＋3秒待ち＋
    // フェード演出より前に発生するようになったため、上のブロードキャスト到達を
    // 待つだけでは読み上げ演出がまだ完了していない。「次の札」ボタンは残り1枚
    // （最後の1枚）を読み上げている間disabledになる（issue #721）ため、
    // 実際のユーザーと同様にボタンが再度押せる状態になるまで待ってから押す
    await waitFor(() => {
      expect(screen.getByText('次の札')).not.toBeDisabled();
    }, { timeout: 20000 });

    // もう一度「次の札」を押すと、未読の札が無いため全て読了したと判定される
    fireEvent.click(screen.getByText('次の札'));

    await waitFor(() => {
      const resultMsg = ws.sent.find((msg) => msg.includes('"action":"updateState"') && msg.includes('"isAllRead":true'));
      expect(resultMsg).toBeDefined();
    }, { timeout: 20000 });
  }, 40000);

  it('shows the winner\'s name in the "これまでに読み上げた札" history once a buzz is judged correct (issue #695)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', answer: '答え1', audioData: 'dummy' }) };
      }
      if (url.includes('/record-time')) return { ok: true, json: async () => ({}) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    fireEvent.click(screen.getByText('次の札'));
    await waitFor(() => {
      expect(ws.sent.find((msg) => msg.includes('"type":"phrase"'))).toBeDefined();
    }, { timeout: 20000 });

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'buzz', name: 'はなこ', connectionId: 'conn-2' }) });
    });
    fireEvent.click(screen.getByText('正解'));

    await waitFor(() => {
      expect(screen.getByText('所要時間')).toBeInTheDocument();
    }, { timeout: 20000 });

    fireEvent.click(screen.getByText(/これまでに読み上げた札を表示する/));

    expect(await screen.findByText('🎉 はなこさん正解')).toBeInTheDocument();
  }, 40000);

  it('reflects both attempts (回答数) and correct (正答数) counts in the room-info participant table after an incorrect judgment followed by a different participant\'s correct judgment (issue #698)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', answer: '答え1', audioData: 'dummy' }) };
      }
      if (url.includes('/record-time')) return { ok: true, json: async () => ({}) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    const roomInfoLink = await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
      ws.onmessage?.({ data: JSON.stringify({ type: 'participants', names: ['たろう', 'はなこ'] }) });
    });

    fireEvent.click(screen.getByText('次の札'));
    await waitFor(() => {
      expect(ws.sent.find((msg) => msg.includes('"type":"phrase"'))).toBeDefined();
    }, { timeout: 20000 });

    // たろうが早押しし、管理者が不正解と判定する。実際のバックエンド
    // （backend/quizRoomHandler.jsのjudgeQuizRoomBuzz）は判定結果をルーム内の
    // 全接続（管理者自身を含む）へブロードキャストするため、judgeAndEcho()で
    // 判定ボタン押下とそのブロードキャストの模擬をワンセットで行う（issue #712）
    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'buzz', name: 'たろう', connectionId: 'conn-1' }) });
    });
    judgeAndEcho(ws, {
      correct: false,
      name: 'たろう',
      answerCounts: { たろう: { attempts: 1, correct: 0 } },
    });

    // はなこが早押しし、管理者が正解と判定する
    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'buzz', name: 'はなこ', connectionId: 'conn-2' }) });
    });
    judgeAndEcho(ws, {
      correct: true,
      points: { はなこ: 1 },
      answerCounts: { たろう: { attempts: 1, correct: 0 }, はなこ: { attempts: 1, correct: 1 } },
    });

    await waitFor(() => {
      expect(screen.getByText('所要時間')).toBeInTheDocument();
    }, { timeout: 20000 });

    fireEvent.click(roomInfoLink);

    // はなこ: 1回答1正答、たろう: 1回答0正答（ポイント降順、同点は名前昇順）
    await waitFor(() => {
      const rows = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
      expect(rows).toEqual(['はなこ接続中11', 'たろう接続中10']);
    }, { timeout: 15000 });
  }, 40000);

  it('does not clear the responder shown to the admin when the same card is re-broadcast (e.g. a settings change re-sends the same phrase), only when the round actually changes (issue #510)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }, { id: 'p2', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    fireEvent.click(screen.getByText('次の札'));
    await waitFor(() => {
      expect(ws.sent.find((msg) => msg.includes('"type":"phrase"'))).toBeDefined();
    }, { timeout: 20000 });

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'buzz', name: 'はなこ', connectionId: 'conn-2' }) });
    });
    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();

    // 同じ札を表示したまま設定を変える（再ブロードキャストが発生するが、ラウンドは
    // 変わっていないので回答者表示は消えてはならない）
    fireEvent.click(screen.getByText('はやい'));

    expect(screen.getByText('🔔 はなこ さんが回答中')).toBeInTheDocument();
  }, 40000);

  it('shows each participant\'s points to the admin as a "points" message arrives, sorted from highest to lowest (issue #519)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'participants', names: ['はなこ', 'たろう'] }) });
      ws.onmessage?.({ data: JSON.stringify({ type: 'points', points: { はなこ: 1, たろう: 3 } }) });
    });

    // 参加者一覧はルーム情報画面（issue #547）の下部に表形式で表示される（issue #587）
    fireEvent.click(screen.getByText('ルーム情報を表示（クイズ大会モード）'));

    expect(screen.getByText('参加者一覧')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
    // たろう(3pt)がはなこ(1pt)より先（降順）に表示される
    expect(rows).toEqual(['たろう接続中03', 'はなこ接続中01']);
  }, 40000);

  it('shows participants who have not scored yet as 0pt in the same list once a "participants" message arrives (issue #545)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    act(() => {
      ws.onmessage?.({ data: JSON.stringify({ type: 'participants', names: ['たろう', 'はなこ', 'じろう'] }) });
      ws.onmessage?.({ data: JSON.stringify({ type: 'points', points: { たろう: 3 } }) });
    });

    // 参加者一覧はルーム情報画面（issue #547）の下部に表形式で表示される（issue #587）
    fireEvent.click(screen.getByText('ルーム情報を表示（クイズ大会モード）'));

    expect(screen.getByText('参加者一覧')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
    // たろう(3pt)がまだ得点していないじろう・はなこ(0pt)より先（降順、同点は名前昇順）
    expect(rows).toEqual(['たろう接続中03', 'じろう接続中00', 'はなこ接続中00']);
  }, 40000);

  it('broadcasts the settings actually used to fetch the admin\'s own audio, even if the admin changes the voice while that card is still being read out (issue #498)', async () => {
    localStorage.setItem('repeatCount', '2');
    localStorage.setItem('speechRate', '80%');
    localStorage.setItem('lang', 'ja');
    localStorage.setItem('voiceId', 'Mizuki');

    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'kids' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', audioData: 'dummy' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('こども向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.();
    });

    fireEvent.click(screen.getByText('次の札'));
    // 読み上げが完了しブロードキャストされるまでの数秒の間に、管理者が声の設定を変更する
    fireEvent.click(screen.getByText('Takumi'));

    await waitFor(() => {
      const phraseBroadcast = ws.sent.find((msg) => msg.includes('"type":"phrase"'));
      expect(phraseBroadcast).toBeDefined();
    }, { timeout: 20000 });

    const payload = JSON.parse(ws.sent.find((msg) => msg.includes('"type":"phrase"')));
    // 実際に管理者が聞いている音声はvoiceId変更前に取得したものなので、ブロードキャストも
    // 変更後のTakumiではなく、取得時点のMizukiのままであるべき
    expect(payload.state.content.voiceId).toBe('Mizuki');
  }, 40000);

  it('shows the list of open quiz rooms on the top page and lets a participant join directly from it (issue #489)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        MockWebSocket.instances.push(this);
      }
      send() {}
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url) => {
      if (url.includes('/quiz-rooms')) {
        return {
          ok: true,
          json: async () => ({
            rooms: [
              { roomId: 'ABC123', createdAt: 2, category: 'Cat1', status: '進行中' },
              { roomId: 'DEF456', createdAt: 1, category: null, status: '開始前' },
            ],
          }),
        };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [] }) };
      if (url.includes('/get-phrase?')) {
        return { ok: true, json: async () => ({ audioData: 'data:audio/mp3;base64,DUMMY' }) };
      }
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    expect(await screen.findByText('開設中のクイズ大会ルーム')).toBeInTheDocument();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('Cat1')).toBeInTheDocument();
    expect(screen.getByText('DEF456')).toBeInTheDocument();
    expect(screen.getByText('開始前')).toBeInTheDocument();

    fireEvent.click(screen.getByText('ABC123'));

    expect(await screen.findByText('クイズ大会モード（参加者）')).toBeInTheDocument();
    // 早押し機能（issue #510）: 参加者はまず名前を入力してから通常の参加者画面へ進む
    fireEvent.change(screen.getByPlaceholderText('お名前'), { target: { value: 'たろう' } });
    fireEvent.click(screen.getByText('決定'));
    expect(screen.getByText('ルーム: ABC123')).toBeInTheDocument();

    // ブラウザの自動再生ポリシー対策（issue #497, #514）: 一覧からの参加クリックに便乗して、
    // 共有<audio>要素（issue #514）に無音再生による解錠を行っていることを確認する
    const unlockedInstance = window.Audio.mock.results
      .map((result) => result.value)
      .find((audio) => typeof audio.src === 'string' && audio.src.startsWith('data:audio/wav'));
    expect(unlockedInstance).toBeDefined();

    // issue #514: 一覧クリック（App.jsx）で解錠した要素と、参加者画面（QuizRoomView.jsx）が
    // 実際に札の音声を再生する要素が、同一の（=解錠済みの）要素であることを確認する。
    // 別々のAudioインスタンスを使っていると、解錠の効果が実際の再生に及ばずSafari等で
    // ブロックされ続けてしまう
    const participantWs = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    await act(async () => {
      participantWs.onmessage?.({
        data: JSON.stringify({
          type: 'state',
          state: { type: 'phrase', content: { id: 'p1', category: 'Cat1', phrase: '読み札1', level: '3' } },
          role: 'participant',
        }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(unlockedInstance.src).toBe('data:audio/mp3;base64,DUMMY');
    // sharedAudio（読み上げ用）+ buzz/correct/incorrectの効果音用（issue #613）で計4要素
    expect(window.Audio).toHaveBeenCalledTimes(4);
  });

  it('does not show the open-room list section when there are no open quiz rooms', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('/quiz-rooms')) return { ok: true, json: async () => ({ rooms: [] }) };
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    await screen.findByText('かるた読み上げアプリ');
    expect(screen.queryByText('開設中のクイズ大会ルーム')).not.toBeInTheDocument();
    // openQuizRoomsが0件の場合は「他の」を付けない（issue #502）
    expect(screen.getByText('クイズ大会に参加する')).toBeInTheDocument();
  });

  it('places the quiz-room join link below the open-room list, and the footer links (all-phrases/comments/changelog) at the very bottom, with the label changed to "他のクイズ大会に参加する" when rooms are open (issue #502)', async () => {
    fetch.mockImplementation(async (url) => {
      if (url.includes('/quiz-rooms')) {
        return { ok: true, json: async () => ({ rooms: [{ roomId: 'ABC123', createdAt: 1, category: 'Cat1' }] }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    await screen.findByText('開設中のクイズ大会ルーム');
    expect(screen.queryByText('クイズ大会に参加する')).not.toBeInTheDocument();
    const joinOtherLink = screen.getByText('他のクイズ大会に参加する');
    expect(joinOtherLink).toBeInTheDocument();

    // 表示順: 開設中ルーム一覧 → 「他のクイズ大会に参加する」 → 全札一覧等のフッターリンク（最下部）
    const openRoomHeading = screen.getByText('開設中のクイズ大会ルーム');
    const allPhrasesLink = screen.getByText(/全札一覧を見る/);
    const commentsLink = screen.getByText('指摘された内容を確認する');
    const changelogLink = screen.getByText('更新履歴を見る');

    expect(openRoomHeading.compareDocumentPosition(joinOtherLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(joinOtherLink.compareDocumentPosition(allPhrasesLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(allPhrasesLink.compareDocumentPosition(commentsLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(commentsLink.compareDocumentPosition(changelogLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not log an error when the quiz-rooms endpoint responds with a non-JSON-bearing failure (e.g. no response body at all)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetch.mockImplementation(async (url) => {
      // レスポンスがok:falseのみで、jsonメソッドを持たないケース（例えば502等で
      // ボディがJSONではない場合）を模す。response.okを確認する前にresponse.json()を
      // 呼んでいると、ここで"response.json is not a function"が投げられてしまう
      if (url.includes('/quiz-rooms')) return { ok: false };
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    await screen.findByText('かるた読み上げアプリ');
    const quizRoomsErrors = consoleErrorSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('Failed to fetch open quiz rooms')
    );
    expect(quizRoomsErrors).toHaveLength(0);
  });

  it('re-fetches the open quiz room list every time the top page is shown again, not just on first mount (issue #531)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        MockWebSocket.instances.push(this);
      }
      send() {}
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    let quizRoomsCallCount = 0;
    fetch.mockImplementation(async (url) => {
      if (url.includes('/quiz-rooms')) {
        quizRoomsCallCount += 1;
        const rooms = quizRoomsCallCount === 1
          ? [{ roomId: 'ABC123', createdAt: 1, category: null }]
          : [{ roomId: 'ABC123', createdAt: 1, category: null }, { roomId: 'NEW999', createdAt: 2, category: null }];
        return { ok: true, json: async () => ({ rooms }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    await screen.findByText('ABC123');
    expect(quizRoomsCallCount).toBe(1);
    expect(screen.queryByText('NEW999')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('ABC123'));
    await screen.findByText('クイズ大会モード（参加者）');
    fireEvent.change(screen.getByPlaceholderText('お名前'), { target: { value: 'たろう' } });
    fireEvent.click(screen.getByText('決定'));

    fireEvent.click(screen.getByText('← 戻る'));

    await waitFor(() => expect(quizRoomsCallCount).toBe(2));
    expect(await screen.findByText('NEW999')).toBeInTheDocument();
  });

  it('periodically refreshes the open quiz room list while staying on the top page, so a newly created room shows up without navigating away and back (issue #640)', async () => {
    let quizRoomsCallCount = 0;
    fetch.mockImplementation(async (url) => {
      if (url.includes('/quiz-rooms')) {
        quizRoomsCallCount += 1;
        const rooms = quizRoomsCallCount < 3
          ? [{ roomId: 'ABC123', createdAt: 1, category: null }]
          : [{ roomId: 'NEW999', createdAt: 2, category: null }, { roomId: 'ABC123', createdAt: 1, category: null }];
        return { ok: true, json: async () => ({ rooms }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    await screen.findByText('ABC123');
    expect(quizRoomsCallCount).toBe(1);

    // 別画面（全札一覧）へ移動する（実タイマーのまま）
    fireEvent.click(screen.getByText('全札一覧を見る →'));
    await screen.findByText('← 戻る');
    expect(quizRoomsCallCount).toBe(1);

    // ここでフェイクタイマーへ切り替えてからトップページへ戻ることで、ポーリング用の
    // setIntervalをこの後のフェイクタイマー下で新規に張らせる（実タイマーで既に
    // 張られていたsetIntervalは、後からvi.useFakeTimers()に切り替えても
    // フェイク時計の対象にはならないため）
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByText('← 戻る'));
    });
    expect(quizRoomsCallCount).toBe(2);
    expect(screen.getByText('ABC123')).toBeInTheDocument();

    // ポーリング間隔（15秒）を1回分進める。トップページ遷移をまたがずとも
    // 一覧が再取得されることを確認する。findBy/waitForはフェイクタイマー下では
    // 内部の再試行が進まないため、advanceTimersByTimeAsync後は同期的なgetByText
    // で確認する（issue #614のテストと同じ方針）
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    vi.useRealTimers();

    expect(quizRoomsCallCount).toBe(3);
    expect(screen.getByText('NEW999')).toBeInTheDocument();
  });

  it('refreshes the open quiz room list immediately when the tab/app returns to the foreground (issue #640)', async () => {
    let quizRoomsCallCount = 0;
    fetch.mockImplementation(async (url) => {
      if (url.includes('/quiz-rooms')) {
        quizRoomsCallCount += 1;
        const rooms = quizRoomsCallCount === 1
          ? [{ roomId: 'ABC123', createdAt: 1, category: null }]
          : [{ roomId: 'NEW999', createdAt: 2, category: null }, { roomId: 'ABC123', createdAt: 1, category: null }];
        return { ok: true, json: async () => ({ rooms }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [] }) };
      return { ok: false };
    });

    await act(async () => {
      render(<App />);
    });

    await screen.findByText('ABC123');
    expect(quizRoomsCallCount).toBe(1);

    // バックグラウンドへ回してからフォアグラウンドへ復帰した状況を模す
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(quizRoomsCallCount).toBe(2));
    expect(await screen.findByText('NEW999')).toBeInTheDocument();
  });

  it('persists the admin token on room creation, then lets a fresh session (e.g. after closing the tab) restore admin mode from the participant screen using the saved token (issue #697)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('/quiz-room?roomId=')) {
        return { ok: true, json: async () => ({ exists: true }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      return { ok: false };
    });

    const firstRender = await act(async () => render(<App />));

    fireEvent.click(await screen.findByText('エンジニア向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByText(/かるたを始める/));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    // 管理者トークンはlocalStorageへ保存される
    expect(JSON.parse(localStorage.getItem('quizRoomAdminSession'))).toEqual({ roomId: 'ABC123', adminToken: 'token-1' });

    // ブラウザ/タブを閉じた状況を模す。Reactのstateはここで失われるが、localStorageは残る
    firstRender.unmount();

    // 招待URL経由で参加者として同じルームへアクセスした状況を模す
    window.history.pushState({}, '', '?view=quiz-room&roomId=ABC123');
    await act(async () => {
      render(<App />);
    });

    fireEvent.change(await screen.findByPlaceholderText('お名前'), { target: { value: 'はなこ' } });
    fireEvent.click(screen.getByText('決定'));
    await screen.findByText('クイズ大会モード（参加者）');

    // 保存済みの管理者トークンが今のルームIDと一致するため、切り替えボタンが表示される
    const switchButton = await screen.findByText('管理者に切り替える');
    fireEvent.click(switchButton);

    // 管理者画面（ルーム情報）へ切り替わる
    await screen.findByText('クイズ大会モードのルーム情報');

    const adminConnections = MockWebSocket.instances.filter((instance) => instance.url.includes('adminToken='));
    expect(adminConnections).toHaveLength(2); // 1回目の作成時 + 今回の復帰時
    expect(adminConnections[1].url).toContain('roomId=ABC123');
    expect(adminConnections[1].url).toContain('adminToken=token-1');

    // 復帰した接続が確立すれば、エラー表示は出ず管理者画面に留まる
    act(() => {
      adminConnections[1].readyState = MockWebSocket.OPEN;
      adminConnections[1].onopen?.();
    });
    expect(screen.getByText('クイズ大会モードのルーム情報')).toBeInTheDocument();
  }, 40000);

  it('offers to resume the saved admin session from the reading screen itself, instead of only via the participant URL (issue #744)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      return { ok: false };
    });

    const firstRender = await act(async () => render(<App />));

    fireEvent.click(await screen.findByText('エンジニア向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByText(/かるたを始める/));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    // ブラウザ/タブを閉じた状況を模す。Reactのstateはここで失われるが、localStorageは残る
    firstRender.unmount();

    // URLの?roomId=を経由せず、素朴にトップから読み上げ画面へ戻ってきた状況を模す
    window.history.pushState({}, '', '/');
    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByText(/かるたを始める/));
    await waitFor(() => screen.getByText('次の札'));

    // 従来は「クイズ大会のルームを作成する」ボタンしかなく、これを押すと別の新しい
    // ルームが作られてしまっていた（issue #744）。保存済みセッションがある今は、
    // 読み上げ画面自体に「再開する」ボタンが出る。誤って別の新しいルームを作って
    // しまわないよう、再開可能な間は新規作成ボタン自体を表示しない（issue #748）
    expect(screen.queryByText('クイズ大会のルームを作成する')).not.toBeInTheDocument();
    const resumeButton = screen.getByText('クイズ大会のルームを再開する');
    fireEvent.click(resumeButton);

    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    const adminConnections = MockWebSocket.instances.filter((instance) => instance.url.includes('adminToken='));
    expect(adminConnections).toHaveLength(2); // 1回目の作成時 + 今回の再開時
    expect(adminConnections[1].url).toContain('roomId=ABC123');
    expect(adminConnections[1].url).toContain('adminToken=token-1');

    // 復帰した接続が確立すれば、エラー表示は出ずルーム情報画面に留まる
    act(() => {
      adminConnections[1].readyState = MockWebSocket.OPEN;
      adminConnections[1].onopen?.();
    });
    expect(screen.getByText('ルーム情報を表示（クイズ大会モード）')).toBeInTheDocument();
  }, 40000);

  it('discards the saved admin token and falls back to the participant screen with an error when the saved token fails to connect (issue #697)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    // 事前に（失効済み・無効化された）管理者トークンが保存されている状況を模す
    localStorage.setItem('quizRoomAdminSession', JSON.stringify({ roomId: 'XYZ999', adminToken: 'stale-token' }));

    fetch.mockImplementation(async (url) => {
      if (url.includes('/quiz-room?roomId=')) {
        return { ok: true, json: async () => ({ exists: true }) };
      }
      return { ok: false };
    });

    window.history.pushState({}, '', '?view=quiz-room&roomId=XYZ999');
    await act(async () => {
      render(<App />);
    });

    fireEvent.change(await screen.findByPlaceholderText('お名前'), { target: { value: 'たろう' } });
    fireEvent.click(screen.getByText('決定'));
    await screen.findByText('クイズ大会モード（参加者）');

    const switchButton = await screen.findByText('管理者に切り替える');
    fireEvent.click(switchButton);
    await screen.findByText('クイズ大会モードのルーム情報');

    const adminConnection = MockWebSocket.instances.find((instance) => instance.url.includes('adminToken=stale-token'));
    expect(adminConnection).toBeDefined();

    // 保存済みトークンが無効だった（ルーム失効・削除済み等）状況を模す
    act(() => {
      adminConnection.onerror?.();
    });

    // 参加者画面へ戻り、エラーメッセージが表示される
    await screen.findByText('クイズ大会モード（参加者）');
    expect(screen.getByText(/保存されていた管理者情報でルームに接続できませんでした/)).toBeInTheDocument();

    // 無効だったトークンは破棄され、切り替えボタンも消える
    expect(screen.queryByText('管理者に切り替える')).not.toBeInTheDocument();
    expect(localStorage.getItem('quizRoomAdminSession')).toBeNull();
  }, 40000);

  it('closes the room from the room-info screen, clears the saved admin session, and returns to the reading screen (issue #748)', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      return { ok: false };
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByText(/かるたを始める/));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');
    expect(JSON.parse(localStorage.getItem('quizRoomAdminSession'))).toEqual({ roomId: 'ABC123', adminToken: 'token-1' });

    const adminConnection = MockWebSocket.instances.find((instance) => instance.url.includes('adminToken=token-1'));
    act(() => {
      adminConnection.readyState = MockWebSocket.OPEN;
      adminConnection.onopen?.();
    });

    fireEvent.click(screen.getByText('ルーム情報を表示（クイズ大会モード）'));
    const closeButton = await screen.findByText('ルームを閉じる');
    fireEvent.click(closeButton);
    expect(confirmSpy).toHaveBeenCalled();

    expect(adminConnection.sent).toContainEqual(JSON.stringify({ action: 'closeRoom' }));

    // サーバーからのroomClosedブロードキャストを模す
    act(() => {
      adminConnection.onmessage?.({ data: JSON.stringify({ type: 'roomClosed' }) });
    });

    // 読み上げ画面へ戻り、保存済みセッションが破棄されるため、新規作成ボタンが再び表示される
    await screen.findByText('クイズ大会のルームを作成する');
    expect(screen.queryByText('クイズ大会のルームを再開する')).not.toBeInTheDocument();
    expect(localStorage.getItem('quizRoomAdminSession')).toBeNull();

    confirmSpy.mockRestore();
  }, 40000);

  it('does not close the room when the confirmation dialog is dismissed', async () => {
    class MockWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        MockWebSocket.instances.push(this);
      }
      send(data) {
        this.sent.push(data);
      }
      close() {}
    }
    MockWebSocket.OPEN = 1;
    MockWebSocket.instances = [];
    window.WebSocket = MockWebSocket;

    fetch.mockImplementation(async (url, options) => {
      if (url.includes('/quiz-room') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ roomId: 'ABC123', adminToken: 'token-1' }) };
      }
      if (url.includes('get-categories')) return { ok: true, json: async () => ({ categories: [{ name: 'Cat1', group: 'engineer' }] }) };
      if (url.includes('get-phrases-list')) return { ok: true, json: async () => ({ phrases: [{ id: 'p1', category: 'Cat1' }] }) };
      return { ok: false };
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    await act(async () => {
      render(<App />);
    });

    fireEvent.click(await screen.findByText('エンジニア向け'));
    fireEvent.click(await screen.findByRole('button', { name: /Cat1/ }));
    fireEvent.click(screen.getByText(/かるたを始める/));
    await waitFor(() => screen.getByText('次の札'));

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');
    fireEvent.click(screen.getByText('ルーム情報を表示（クイズ大会モード）'));

    const closeButton = await screen.findByText('ルームを閉じる');
    fireEvent.click(closeButton);
    expect(confirmSpy).toHaveBeenCalled();

    const adminConnection = MockWebSocket.instances.find((instance) => instance.url.includes('adminToken=token-1'));
    expect(adminConnection.sent).not.toContainEqual(JSON.stringify({ action: 'closeRoom' }));
    expect(JSON.parse(localStorage.getItem('quizRoomAdminSession'))).toEqual({ roomId: 'ABC123', adminToken: 'token-1' });

    confirmSpy.mockRestore();
  }, 40000);
});
