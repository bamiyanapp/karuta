import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuizRoomSync } from './useQuizRoomSync';

class MockWebSocket {
  static OPEN = 1;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    MockWebSocket.instances.push(this);
  }

  send(data) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  // テスト用ヘルパー（実ブラウザのWebSocketイベントを模擬する）
  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  triggerMessage(data) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  triggerClose() {
    this.readyState = 3;
    this.onclose?.();
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  window.WebSocket = MockWebSocket;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useQuizRoomSync', () => {
  it('stays idle and opens no connection when wsBaseUrl or roomId is missing', () => {
    const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: null, roomId: 'ROOM01', onState: vi.fn() }));
    expect(result.current.connectionStatus).toBe('idle');
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('connects with roomId in the query string and no adminToken for a participant', () => {
    renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

    expect(MockWebSocket.instances).toHaveLength(1);
    const url = new URL(MockWebSocket.instances[0].url);
    expect(url.searchParams.get('roomId')).toBe('ROOM01');
    expect(url.searchParams.has('adminToken')).toBe(false);
  });

  it('includes adminToken in the query string for an admin', () => {
    renderHook(() => useQuizRoomSync({
      wsBaseUrl: 'wss://example.com/dev',
      roomId: 'ROOM01',
      adminToken: 'secret-token',
      onState: vi.fn(),
    }));

    const url = new URL(MockWebSocket.instances[0].url);
    expect(url.searchParams.get('adminToken')).toBe('secret-token');
  });

  it('sends a sync request and becomes connected on open', () => {
    const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });

    expect(result.current.connectionStatus).toBe('connected');
    expect(MockWebSocket.instances[0].sent).toEqual([JSON.stringify({ action: 'sync' })]);
  });

  it('calls onState with the received state and role', () => {
    const onState = vi.fn();
    renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      MockWebSocket.instances[0].triggerMessage({ type: 'state', state: { type: 'phrase', phrase: { id: 'p1' } }, role: 'participant' });
    });

    expect(onState).toHaveBeenCalledWith({ type: 'phrase', phrase: { id: 'p1' } }, 'participant');
  });

  it('ignores malformed messages without throwing', () => {
    const onState = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      MockWebSocket.instances[0].onmessage({ data: 'not-json' });
    });

    expect(onState).not.toHaveBeenCalled();
  });

  it('calls onBuzz when a buzz message is received, without invoking onState (issue #510)', () => {
    const onState = vi.fn();
    const onBuzz = vi.fn();
    renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState, onBuzz }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      MockWebSocket.instances[0].triggerMessage({ type: 'buzz', name: 'たろう', connectionId: 'conn-2' });
    });

    expect(onBuzz).toHaveBeenCalledWith({ name: 'たろう', connectionId: 'conn-2' });
    expect(onState).not.toHaveBeenCalled();
  });

  it('calls onPoints when a points message is received (issue #519)', () => {
    const onPoints = vi.fn();
    renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn(), onPoints }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      MockWebSocket.instances[0].triggerMessage({ type: 'points', points: { たろう: 2, はなこ: 1 } });
    });

    expect(onPoints).toHaveBeenCalledWith({ たろう: 2, はなこ: 1 });
  });

  it('calls onNameError when a nameError message is received (issue #519)', () => {
    const onNameError = vi.fn();
    renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn(), onNameError }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      MockWebSocket.instances[0].triggerMessage({ type: 'nameError', message: 'その名前は既に使われています。' });
    });

    expect(onNameError).toHaveBeenCalledWith('その名前は既に使われています。');
  });

  it('calls onRoundReset when a roundReset message is received (issue #546)', () => {
    const onRoundReset = vi.fn();
    renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn(), onRoundReset }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      MockWebSocket.instances[0].triggerMessage({ type: 'roundReset', excludedName: 'たろう' });
    });

    expect(onRoundReset).toHaveBeenCalledWith({ excludedName: 'たろう' });
  });

  it('calls onParticipants when a participants message is received (issue #545)', () => {
    const onParticipants = vi.fn();
    renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn(), onParticipants }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      MockWebSocket.instances[0].triggerMessage({ type: 'participants', names: ['たろう', 'はなこ'] });
    });

    expect(onParticipants).toHaveBeenCalledWith(['たろう', 'はなこ']);
  });

  it('judgeBuzz sends judgeBuzz with the correct flag only while the connection is open', () => {
    const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

    act(() => {
      result.current.judgeBuzz(true);
    });
    expect(MockWebSocket.instances[0].sent).toEqual([]);

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });
    act(() => {
      result.current.judgeBuzz(false);
    });

    expect(MockWebSocket.instances[0].sent).toContainEqual(JSON.stringify({ action: 'judgeBuzz', correct: false }));
  });

  it('resetPoints sends resetPoints only while the connection is open (issue #615)', () => {
    const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

    act(() => {
      result.current.resetPoints();
    });
    expect(MockWebSocket.instances[0].sent).toEqual([]);

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      result.current.resetPoints();
    });

    expect(MockWebSocket.instances[0].sent).toContainEqual(JSON.stringify({ action: 'resetPoints' }));
  });

  it('setParticipantName sends setName only while the connection is open, and resends it once the socket opens if called earlier', () => {
    const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

    act(() => {
      result.current.setParticipantName('たろう');
    });
    expect(MockWebSocket.instances[0].sent).toEqual([]);

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });

    expect(MockWebSocket.instances[0].sent).toEqual([
      JSON.stringify({ action: 'sync' }),
      JSON.stringify({ action: 'setName', name: 'たろう' }),
    ]);
  });

  it('buzz sends the buzz action only while the connection is open', () => {
    const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

    act(() => {
      result.current.buzz();
    });
    expect(MockWebSocket.instances[0].sent).toEqual([]);

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      result.current.buzz();
    });

    expect(MockWebSocket.instances[0].sent).toContain(JSON.stringify({ action: 'buzz' }));
  });

  it('broadcastState sends updateState only while the connection is open', () => {
    const { result } = renderHook(() => useQuizRoomSync({
      wsBaseUrl: 'wss://example.com/dev',
      roomId: 'ROOM01',
      adminToken: 'secret-token',
      onState: vi.fn(),
    }));

    act(() => {
      result.current.broadcastState({ type: 'phrase' });
    });
    expect(MockWebSocket.instances[0].sent).toEqual([]);

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      result.current.broadcastState({ type: 'phrase', phrase: { id: 'p1' } });
    });

    expect(MockWebSocket.instances[0].sent).toContain(
      JSON.stringify({ action: 'updateState', state: { type: 'phrase', phrase: { id: 'p1' } } })
    );
  });

  it('resends the last broadcastState call once the socket opens, even if it was attempted before the connection was ready (regression: participant never saw updates because the admin\'s first broadcast raced ahead of the WebSocket handshake)', () => {
    const { result } = renderHook(() => useQuizRoomSync({
      wsBaseUrl: 'wss://example.com/dev',
      roomId: 'ROOM01',
      adminToken: 'secret-token',
      onState: vi.fn(),
    }));

    // 接続がOPENになる前にbroadcastStateが呼ばれる（Lambdaコールドスタート等で
    // ハンドシェイクに時間がかかる場合に発生する）
    act(() => {
      result.current.broadcastState({ type: 'phrase', phrase: { id: 'p1' } });
    });
    expect(MockWebSocket.instances[0].sent).toEqual([]);

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });

    expect(MockWebSocket.instances[0].sent).toEqual([
      JSON.stringify({ action: 'sync' }),
      JSON.stringify({ action: 'updateState', state: { type: 'phrase', phrase: { id: 'p1' } } }),
    ]);
  });

  it('resends the last broadcastState call again on reconnect, so participants recover in sync after a dropped connection', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useQuizRoomSync({
      wsBaseUrl: 'wss://example.com/dev',
      roomId: 'ROOM01',
      adminToken: 'secret-token',
      onState: vi.fn(),
    }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      result.current.broadcastState({ type: 'phrase', phrase: { id: 'p1' } });
    });

    act(() => {
      MockWebSocket.instances[0].triggerClose();
      vi.advanceTimersByTime(3000);
    });
    act(() => {
      MockWebSocket.instances[1].triggerOpen();
    });

    expect(MockWebSocket.instances[1].sent).toEqual([
      JSON.stringify({ action: 'sync' }),
      JSON.stringify({ action: 'updateState', state: { type: 'phrase', phrase: { id: 'p1' } } }),
    ]);
  });

  it('periodically re-requests sync while connected, as a fallback in case a broadcast is missed (issue #619: 45秒基準+ジッター)', () => {
    vi.useFakeTimers();
    // ジッター（Math.random() * SYNC_POLL_JITTER_MS）を0固定にし、間隔を基準値
    // （45秒）ちょうどに決定的にする
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });
    expect(MockWebSocket.instances[0].sent).toEqual([JSON.stringify({ action: 'sync' })]);

    act(() => {
      vi.advanceTimersByTime(45000);
    });
    expect(MockWebSocket.instances[0].sent).toEqual([
      JSON.stringify({ action: 'sync' }),
      JSON.stringify({ action: 'sync' }),
    ]);

    act(() => {
      vi.advanceTimersByTime(45000);
    });
    expect(MockWebSocket.instances[0].sent).toHaveLength(3);

    randomSpy.mockRestore();
  });

  it('skips sending the periodic sync while the tab is hidden, and resumes once visible again (issue #619)', () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const setVisibilityState = (state) => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    };

    renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
    });
    expect(MockWebSocket.instances[0].sent).toHaveLength(1);

    setVisibilityState('hidden');
    act(() => {
      vi.advanceTimersByTime(45000);
    });
    // 非表示の間はポーリングのsync送信自体をスキップする
    expect(MockWebSocket.instances[0].sent).toHaveLength(1);

    // フォアグラウンド復帰時、visibilitychangeハンドラが即座に1回同期する
    setVisibilityState('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(MockWebSocket.instances[0].sent).toHaveLength(2);

    randomSpy.mockRestore();
    setVisibilityState('visible');
  });

  it('stops polling once the connection closes', () => {
    vi.useFakeTimers();
    renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

    act(() => {
      MockWebSocket.instances[0].triggerOpen();
      MockWebSocket.instances[0].triggerClose();
    });
    const sentAtClose = MockWebSocket.instances[0].sent.length;

    act(() => {
      vi.advanceTimersByTime(20000);
    });
    // 再接続タイマー（3秒後）は動くが、閉じた古い接続へのポーリング送信は増えない
    expect(MockWebSocket.instances[0].sent).toHaveLength(sentAtClose);
  });

  it('reconnects after a close and gives up after the retry limit', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const instance = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      act(() => {
        instance.triggerClose();
      });
      expect(result.current.connectionStatus).toBe('connecting');
      act(() => {
        vi.advanceTimersByTime(3000);
      });
    }

    expect(MockWebSocket.instances).toHaveLength(6); // 初回接続 + 5回の再接続
    act(() => {
      MockWebSocket.instances[MockWebSocket.instances.length - 1].triggerClose();
    });
    expect(result.current.connectionStatus).toBe('error');
  });

  // issue #614: スマホの画面ロック・バックグラウンド復帰後、WebSocketが切断された
  // ままになり自動再接続されないことがある不具合の対応
  describe('reconnecting on foreground/online recovery (issue #614)', () => {
    const setVisibilityState = (state) => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    };

    afterEach(() => {
      setVisibilityState('visible');
    });

    it('immediately reconnects when the tab becomes visible again, even after the retry limit was exhausted', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const instance = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        act(() => {
          instance.triggerClose();
          vi.advanceTimersByTime(3000);
        });
      }
      act(() => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1].triggerClose();
      });
      expect(result.current.connectionStatus).toBe('error');
      const countBeforeVisible = MockWebSocket.instances.length;

      setVisibilityState('visible');
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // 試行回数を使い切った後でも、フォアグラウンド復帰で即座に新しい接続が張られる
      expect(MockWebSocket.instances).toHaveLength(countBeforeVisible + 1);
      expect(result.current.connectionStatus).toBe('connecting');
    });

    it('does not reconnect when visibilitychange fires while the tab is still hidden', () => {
      vi.useFakeTimers();
      renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));
      const countBefore = MockWebSocket.instances.length;

      setVisibilityState('hidden');
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(MockWebSocket.instances).toHaveLength(countBefore);
    });

    it('does not open a redundant connection when visibilitychange fires while already connected', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

      act(() => {
        MockWebSocket.instances[0].triggerOpen();
      });
      expect(result.current.connectionStatus).toBe('connected');

      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(MockWebSocket.instances).toHaveLength(1);
    });

    it('reconnects immediately when the browser reports it is back online', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

      act(() => {
        MockWebSocket.instances[0].triggerClose();
      });
      expect(result.current.connectionStatus).toBe('connecting');

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      // オンライン復帰で、3秒の再接続待ちを待たずに即座に新しい接続が張られる
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it('lets the caller trigger a manual reconnect via the returned reconnect() function', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const instance = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        act(() => {
          instance.triggerClose();
          vi.advanceTimersByTime(3000);
        });
      }
      act(() => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1].triggerClose();
      });
      expect(result.current.connectionStatus).toBe('error');

      act(() => {
        result.current.reconnect();
      });

      expect(result.current.connectionStatus).toBe('connecting');
      act(() => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1].triggerOpen();
      });
      expect(result.current.connectionStatus).toBe('connected');
    });

    it('keeps retrying at a slower interval past the retry limit while the tab stays visible, instead of giving up permanently', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const instance = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        act(() => {
          instance.triggerClose();
          vi.advanceTimersByTime(3000);
        });
      }
      act(() => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1].triggerClose();
      });
      expect(result.current.connectionStatus).toBe('error');
      const countAtError = MockWebSocket.instances.length;

      act(() => {
        vi.advanceTimersByTime(15000);
      });

      expect(MockWebSocket.instances).toHaveLength(countAtError + 1);
    });
  });

  it('does not reconnect after the hook unmounts (cleanup closes the connection)', () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useQuizRoomSync({ wsBaseUrl: 'wss://example.com/dev', roomId: 'ROOM01', onState: vi.fn() }));

    unmount();
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
