// src/server/ws-bridge.ts — Bidirectional EventBus <-> WebSocket Bridge
import type { WebSocket } from 'ws';
import type { TypedEventBus } from '../events/event-bus.js';
import type { EventMap, Unsubscribe } from '../types/events.js';
import type { SessionStorage } from '../storage/session-storage.js';
import type { AgentLoop } from '../runtime/agent-loop.js';
import type { WsEventMessage, WsCommandMessage } from '../types/ws-protocol.js';
import { isWsCommandMessage } from '../types/ws-protocol.js';
import { handleCommand } from './command-handler.js';

interface ClientInfo {
  socket: WebSocket;
  connectedAt: Date;
}

export interface WsBridge {
  handleConnection: (socket: WebSocket) => void;
  close: () => void;
  clientCount: () => number;
}

export function createWsBridge(deps: {
  eventBus: TypedEventBus;
  sessionStorage: SessionStorage;
  agentLoop: AgentLoop;
}): WsBridge {
  const { eventBus, sessionStorage, agentLoop } = deps;
  const clients = new Map<WebSocket, ClientInfo>();
  const unsubscribes: Unsubscribe[] = [];

  // Subscribe to all EventBus events and forward to clients
  const eventNames: (keyof EventMap)[] = [
    'run:start', 'run:end', 'run:error', 'run:step',
    'tool:call', 'tool:result',
    'llm:request', 'llm:response',
    'llm:stream:delta', 'llm:stream:tool_start', 'llm:stream:tool_input', 'llm:stream:stop',
    'session:message',
    'agent:spawned', 'agent:status', 'agent:terminated',
    'message:sent', 'message:received',
    'memory:added', 'memory:searched', 'memory:summarized',
    'model:fallback:triggered', 'model:fallback:exhausted', 'model:cooldown:start',
  ];

  for (const eventName of eventNames) {
    const unsub = eventBus.on(eventName, (data: EventMap[typeof eventName]) => {
      const msg: WsEventMessage = {
        type: 'event',
        event: eventName,
        data,
      };
      broadcast(JSON.stringify(msg));
    });
    unsubscribes.push(unsub);
  }

  function broadcast(data: string): void {
    for (const [socket] of clients) {
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(data);
      }
    }
  }

  function handleConnection(socket: WebSocket): void {
    clients.set(socket, { socket, connectedAt: new Date() });

    socket.on('message', (raw: Buffer | string) => {
      try {
        const parsed: unknown = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'));
        if (isWsCommandMessage(parsed)) {
          void handleCommand(parsed, { sessionStorage, agentLoop, socket });
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on('close', () => {
      clients.delete(socket);
    });

    socket.on('error', () => {
      clients.delete(socket);
    });
  }

  function close(): void {
    for (const unsub of unsubscribes) unsub();
    unsubscribes.length = 0;
    for (const [socket] of clients) {
      socket.close();
    }
    clients.clear();
  }

  return {
    handleConnection,
    close,
    clientCount: () => clients.size,
  };
}
