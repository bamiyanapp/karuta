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

describe('useQuizRoomAdmin (via App)', () => {
  beforeEach(() => {
    fetch.mockClear();
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
    sessionStorage.clear();
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
    fireEvent.click(screen.getByText(/決定/));
    await waitFor(() => screen.getByText(/「Cat1」をお手元に持っていますか？/));
    fireEvent.click(screen.getByText('はい'));
    await waitFor(() => screen.getByText('次の札'));

    // クイズ大会ルーム作成前は、参加者登録ボタンがルーム作成ボタンと並んで表示される
    expect(screen.getByText('取った人を記録する参加者を登録する')).toBeInTheDocument();
    expect(screen.getByText('クイズ大会のルームを作成する')).toBeInTheDocument();

    fireEvent.click(screen.getByText('クイズ大会のルームを作成する'));
    await screen.findByText('ルーム情報を表示（クイズ大会モード）');

    // ルーム作成後は参加者登録ボタン自体が非表示になる
    expect(screen.queryByText('取った人を記録する参加者を登録する')).not.toBeInTheDocument();
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
        return { ok: true, json: async () => ({ id: 'p1', category: 'Cat1', kana: 'あ', phrase: '読み札1', level: '-', answer: '答え1', audioData: 'dummy' }) };
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
      ws.onmessage?.({ data: JSON.stringify({ type: 'points', points: { はなこ: 1, たろう: 3 } }) });
    });

    // 参加者一覧はルーム情報画面（issue #547）の下部に表形式で表示される（issue #587）
    fireEvent.click(screen.getByText('ルーム情報を表示（クイズ大会モード）'));

    expect(screen.getByText('参加者一覧')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
    // たろう(3pt)がはなこ(1pt)より先（降順）に表示される
    expect(rows).toEqual(['たろう3pt', 'はなこ1pt']);
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
    expect(rows).toEqual(['たろう3pt', 'じろう0pt', 'はなこ0pt']);
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
              { roomId: 'ABC123', createdAt: 2, category: 'Cat1' },
              { roomId: 'DEF456', createdAt: 1, category: null },
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
    expect(window.Audio).toHaveBeenCalledTimes(1);
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
});
