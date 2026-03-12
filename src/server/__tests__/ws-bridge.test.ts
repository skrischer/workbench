// src/server/__tests__/ws-bridge.test.ts — WS Bridge Unit Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWsBridge } from '../ws-bridge.js';
import type { TypedEventBus } from '../../events/event-bus.js';
import type { EventMap, Unsubscribe } from '../../types/events.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { AgentLoop } from '../../runtime/agent-loop.js';
import type { WebSocket } from 'ws';

// Track subscriptions on the mock event bus
type Listener = (...args: unknown[]) => void;

function createMockEventBus() {
  const subscriptions = new Map<string, Set<Listener>>();

  const bus = {
    on: vi.fn((event: string, listener: Listener): Unsubscribe => {
      if (!subscriptions.has(event)) {
        subscriptions.set(event, new Set());
      }
      subscriptions.get(event)!.add(listener);
      return () => {
        subscriptions.get(event)?.delete(listener);
      };
    }),
    emit: (event: string, data: unknown) => {
      const listeners = subscriptions.get(event);
      if (listeners) {
        for (const listener of listeners) {
          listener(data);
        }
      }
    },
    subscriptions,
  };

  return bus;
}

function createMockSocket(readyState = 1): WebSocket {
  const listeners = new Map<string, Listener[]>();
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn((event: string, handler: Listener) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(handler);
    }),
    // Helper to simulate incoming messages
    _trigger: (event: string, data: unknown) => {
      const handlers = listeners.get(event);
      if (handlers) {
        for (const h of handlers) h(data);
      }
    },
  } as unknown as WebSocket & { _trigger: (event: string, data: unknown) => void };
}

function createMockSessionStorage(): SessionStorage {
  return {
    list: vi.fn(),
    load: vi.fn(),
    create: vi.fn(),
    createSession: vi.fn(),
  } as unknown as SessionStorage;
}

function createMockAgentLoop(): AgentLoop {
  return {
    runStreaming: vi.fn().mockResolvedValue({ result: 'done' }),
    cancel: vi.fn(),
  } as unknown as AgentLoop;
}

describe('createWsBridge', () => {
  let mockBus: ReturnType<typeof createMockEventBus>;
  let sessionStorage: SessionStorage;
  let agentLoop: AgentLoop;

  beforeEach(() => {
    mockBus = createMockEventBus();
    sessionStorage = createMockSessionStorage();
    agentLoop = createMockAgentLoop();
  });

  it('subscribes to all EventMap events on creation', () => {
    createWsBridge({
      eventBus: mockBus as unknown as TypedEventBus,
      sessionStorage,
      agentLoop,
    });

    // The bridge should subscribe to many events
    expect(mockBus.on).toHaveBeenCalled();
    const subscribedEvents = mockBus.on.mock.calls.map(
      (call) => call[0] as string,
    );

    // Check for a representative set of events
    expect(subscribedEvents).toContain('run:start');
    expect(subscribedEvents).toContain('run:end');
    expect(subscribedEvents).toContain('run:error');
    expect(subscribedEvents).toContain('tool:call');
    expect(subscribedEvents).toContain('tool:result');
    expect(subscribedEvents).toContain('llm:stream:delta');
    expect(subscribedEvents).toContain('llm:stream:stop');
    expect(subscribedEvents).toContain('session:message');
  });

  it('broadcasts events to connected clients', () => {
    const bridge = createWsBridge({
      eventBus: mockBus as unknown as TypedEventBus,
      sessionStorage,
      agentLoop,
    });

    const socket = createMockSocket();
    bridge.handleConnection(socket);

    // Emit an event on the bus
    const eventData = { runId: 'r1', agentConfig: { model: 'm', systemPrompt: 's', maxSteps: 1 }, prompt: 'p' };
    mockBus.emit('run:start', eventData);

    expect(socket.send).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((socket.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(sent).toEqual({
      type: 'event',
      event: 'run:start',
      data: eventData,
    });
  });

  it('broadcasts to multiple connected clients', () => {
    const bridge = createWsBridge({
      eventBus: mockBus as unknown as TypedEventBus,
      sessionStorage,
      agentLoop,
    });

    const socket1 = createMockSocket();
    const socket2 = createMockSocket();
    bridge.handleConnection(socket1);
    bridge.handleConnection(socket2);

    mockBus.emit('run:end', { runId: 'r1', result: 'ok', tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } });

    expect(socket1.send).toHaveBeenCalledTimes(1);
    expect(socket2.send).toHaveBeenCalledTimes(1);
  });

  it('does not send to closed sockets', () => {
    const bridge = createWsBridge({
      eventBus: mockBus as unknown as TypedEventBus,
      sessionStorage,
      agentLoop,
    });

    const closedSocket = createMockSocket(3); // WebSocket.CLOSED
    bridge.handleConnection(closedSocket);

    mockBus.emit('run:start', { runId: 'r1', agentConfig: { model: 'm', systemPrompt: 's', maxSteps: 1 }, prompt: 'p' });

    expect(closedSocket.send).not.toHaveBeenCalled();
  });

  it('removes client on socket close', () => {
    const bridge = createWsBridge({
      eventBus: mockBus as unknown as TypedEventBus,
      sessionStorage,
      agentLoop,
    });

    const socket = createMockSocket() as WebSocket & { _trigger: (event: string, data: unknown) => void };
    bridge.handleConnection(socket);
    expect(bridge.clientCount()).toBe(1);

    // Simulate socket close
    socket._trigger('close', undefined);
    expect(bridge.clientCount()).toBe(0);
  });

  it('removes client on socket error', () => {
    const bridge = createWsBridge({
      eventBus: mockBus as unknown as TypedEventBus,
      sessionStorage,
      agentLoop,
    });

    const socket = createMockSocket() as WebSocket & { _trigger: (event: string, data: unknown) => void };
    bridge.handleConnection(socket);
    expect(bridge.clientCount()).toBe(1);

    socket._trigger('error', new Error('connection lost'));
    expect(bridge.clientCount()).toBe(0);
  });

  it('handles incoming command messages from clients', () => {
    const bridge = createWsBridge({
      eventBus: mockBus as unknown as TypedEventBus,
      sessionStorage,
      agentLoop,
    });

    const mockResult = { data: [], total: 0, offset: 0, limit: 50 };
    (sessionStorage.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const socket = createMockSocket() as WebSocket & { _trigger: (event: string, data: unknown) => void };
    bridge.handleConnection(socket);

    // Simulate incoming WS message
    const cmdMsg = JSON.stringify({
      type: 'command',
      command: 'list_sessions',
      requestId: 'req-1',
    });
    socket._trigger('message', cmdMsg);

    // The command should be forwarded to handleCommand (which calls sessionStorage.list)
    // We can't easily await the void promise, but we can verify the mock was called
    // after a microtask
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(sessionStorage.list).toHaveBeenCalled();
        resolve();
      }, 10);
    });
  });

  it('ignores malformed JSON messages', () => {
    const bridge = createWsBridge({
      eventBus: mockBus as unknown as TypedEventBus,
      sessionStorage,
      agentLoop,
    });

    const socket = createMockSocket() as WebSocket & { _trigger: (event: string, data: unknown) => void };
    bridge.handleConnection(socket);

    // Should not throw
    expect(() => {
      socket._trigger('message', 'not-valid-json{{{');
    }).not.toThrow();
  });

  it('ignores non-command messages', () => {
    const bridge = createWsBridge({
      eventBus: mockBus as unknown as TypedEventBus,
      sessionStorage,
      agentLoop,
    });

    const socket = createMockSocket() as WebSocket & { _trigger: (event: string, data: unknown) => void };
    bridge.handleConnection(socket);

    // Send a non-command message
    socket._trigger('message', JSON.stringify({ type: 'event', event: 'run:start', data: {} }));

    expect(sessionStorage.list).not.toHaveBeenCalled();
  });

  it('handles Buffer messages', () => {
    const bridge = createWsBridge({
      eventBus: mockBus as unknown as TypedEventBus,
      sessionStorage,
      agentLoop,
    });

    const mockResult = { data: [], total: 0, offset: 0, limit: 50 };
    (sessionStorage.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

    const socket = createMockSocket() as WebSocket & { _trigger: (event: string, data: unknown) => void };
    bridge.handleConnection(socket);

    // Simulate Buffer message
    const cmdMsg = Buffer.from(
      JSON.stringify({
        type: 'command',
        command: 'list_sessions',
        requestId: 'req-buf',
      }),
    );
    socket._trigger('message', cmdMsg);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(sessionStorage.list).toHaveBeenCalled();
        resolve();
      }, 10);
    });
  });

  describe('close()', () => {
    it('unsubscribes all event listeners', () => {
      const bridge = createWsBridge({
        eventBus: mockBus as unknown as TypedEventBus,
        sessionStorage,
        agentLoop,
      });

      // Track initial subscription count
      let totalListeners = 0;
      for (const [, listeners] of mockBus.subscriptions) {
        totalListeners += listeners.size;
      }
      expect(totalListeners).toBeGreaterThan(0);

      bridge.close();

      // All listeners should be removed
      let remainingListeners = 0;
      for (const [, listeners] of mockBus.subscriptions) {
        remainingListeners += listeners.size;
      }
      expect(remainingListeners).toBe(0);
    });

    it('closes all connected sockets', () => {
      const bridge = createWsBridge({
        eventBus: mockBus as unknown as TypedEventBus,
        sessionStorage,
        agentLoop,
      });

      const socket1 = createMockSocket();
      const socket2 = createMockSocket();
      bridge.handleConnection(socket1);
      bridge.handleConnection(socket2);

      bridge.close();

      expect(socket1.close).toHaveBeenCalled();
      expect(socket2.close).toHaveBeenCalled();
      expect(bridge.clientCount()).toBe(0);
    });
  });

  describe('clientCount()', () => {
    it('returns 0 when no clients connected', () => {
      const bridge = createWsBridge({
        eventBus: mockBus as unknown as TypedEventBus,
        sessionStorage,
        agentLoop,
      });
      expect(bridge.clientCount()).toBe(0);
    });

    it('reflects current number of connected clients', () => {
      const bridge = createWsBridge({
        eventBus: mockBus as unknown as TypedEventBus,
        sessionStorage,
        agentLoop,
      });

      bridge.handleConnection(createMockSocket());
      expect(bridge.clientCount()).toBe(1);

      bridge.handleConnection(createMockSocket());
      expect(bridge.clientCount()).toBe(2);
    });
  });
});
