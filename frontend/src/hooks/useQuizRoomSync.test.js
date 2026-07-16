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
