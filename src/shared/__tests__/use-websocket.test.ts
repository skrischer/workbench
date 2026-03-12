// src/shared/__tests__/use-websocket.test.ts — WebSocket hook tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../ws-client/use-websocket.js';

// --- Mock WebSocket ---

type WsListener = (event: Record<string, unknown>) => void;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  url: string;

  private listeners = new Map<string, WsListener[]>();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(event: string, handler: WsListener) {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
  }

  removeEventListener(event: string, handler: WsListener) {
    const handlers = this.listeners.get(event) ?? [];
    this.listeners.set(event, handlers.filter((h) => h !== handler));
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  // Test helpers
  _triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    for (const h of this.listeners.get('open') ?? []) h({} as Record<string, unknown>);
  }

  _triggerMessage(data: string) {
    for (const h of this.listeners.get('message') ?? []) h({ data } as Record<string, unknown>);
  }

  _triggerClose() {
    this.readyState = MockWebSocket.CLOSED;
    for (const h of this.listeners.get('close') ?? []) h({} as Record<string, unknown>);
  }

  _triggerError() {
    for (const h of this.listeners.get('error') ?? []) h({} as Record<string, unknown>);
  }
}

// @vitest-environment jsdom
describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('connects on mount and sets status to connected', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(result.current.status).toBe('connecting');

    act(() => {
      MockWebSocket.instances[0]._triggerOpen();
    });

    expect(result.current.status).toBe('connected');
  });

  it('sets lastMessage on incoming server event', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

    act(() => {
      MockWebSocket.instances[0]._triggerOpen();
    });

    const msg = JSON.stringify({ type: 'event', event: 'run:start', data: { runId: 'r1' } });
    act(() => {
      MockWebSocket.instances[0]._triggerMessage(msg);
    });

    expect(result.current.lastMessage).toEqual({
      type: 'event',
      event: 'run:start',
      data: { runId: 'r1' },
    });
  });

  it('ignores non-JSON messages', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

    act(() => {
      MockWebSocket.instances[0]._triggerOpen();
    });

    act(() => {
      MockWebSocket.instances[0]._triggerMessage('not-json{{{');
    });

    expect(result.current.lastMessage).toBeNull();
  });

  it('ignores messages that are not valid ServerMessages', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

    act(() => {
      MockWebSocket.instances[0]._triggerOpen();
    });

    act(() => {
      MockWebSocket.instances[0]._triggerMessage(JSON.stringify({ type: 'unknown' }));
    });

    expect(result.current.lastMessage).toBeNull();
  });

  it('sends a command message when send() is called', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

    act(() => {
      MockWebSocket.instances[0]._triggerOpen();
    });

    act(() => {
      result.current.send('list_sessions', undefined, 'req-1');
    });

    expect(MockWebSocket.instances[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'command', command: 'list_sessions', requestId: 'req-1' }),
    );
  });

  it('does not send when socket is not open', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

    // Still in CONNECTING state
    act(() => {
      result.current.send('list_sessions');
    });

    expect(MockWebSocket.instances[0].send).not.toHaveBeenCalled();
  });

  it('reconnects with exponential backoff after close', () => {
    renderHook(() => useWebSocket('ws://localhost:3000/ws'));

    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      MockWebSocket.instances[0]._triggerClose();
    });

    // First reconnect: 1s
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    act(() => {
      MockWebSocket.instances[1]._triggerClose();
    });

    // Second reconnect: 2s
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(MockWebSocket.instances).toHaveLength(2); // not yet
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('resets retry counter on successful connection', () => {
    renderHook(() => useWebSocket('ws://localhost:3000/ws'));

    // First close + reconnect
    act(() => { MockWebSocket.instances[0]._triggerClose(); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(MockWebSocket.instances).toHaveLength(2);

    // Successful reconnect
    act(() => { MockWebSocket.instances[1]._triggerOpen(); });

    // Close again — should use 1s delay (reset)
    act(() => { MockWebSocket.instances[1]._triggerClose(); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));
    const ws = MockWebSocket.instances[0];

    act(() => { ws._triggerOpen(); });

    unmount();

    expect(ws.close).toHaveBeenCalled();
  });

  it('cleans up reconnect timer on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

    act(() => { MockWebSocket.instances[0]._triggerClose(); });

    unmount();

    // Advancing time should not create new WebSocket instances
    const countBefore = MockWebSocket.instances.length;
    act(() => { vi.advanceTimersByTime(5000); });
    expect(MockWebSocket.instances.length).toBe(countBefore);
  });

  it('sets error status on error event', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3000/ws'));

    act(() => {
      MockWebSocket.instances[0]._triggerError();
    });

    expect(result.current.status).toBe('error');
  });
});
