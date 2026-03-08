// src/dashboard/ws-bridge.ts — WebSocket Bridge for Event Broadcasting

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { TypedEventBus } from '../events/event-bus.js';
import type { EventMap } from '../types/events.js';
import { randomUUID } from 'crypto';

/**
 * WebSocket message types (Client → Server)
 */
interface SubscribeMessage {
  type: 'subscribe';
  events: string[];
}

interface UnsubscribeMessage {
  type: 'unsubscribe';
  events: string[];
}

type ClientMessage = SubscribeMessage | UnsubscribeMessage;

/**
 * WebSocket message types (Server → Client)
 */
interface ConnectedMessage {
  type: 'connected';
  clientId: string;
  subscribedEvents: string[];
}

interface EventMessage {
  type: 'event';
  event: string;
  data: unknown;
  timestamp: string;
}

interface PingMessage {
  type: 'ping';
}

type ServerMessage = ConnectedMessage | EventMessage | PingMessage;

/**
 * Client connection state.
 */
interface ClientState {
  clientId: string;
  connectedAt: Date;
  subscribedEvents: Set<string>;
  ws: WebSocket;
  pingInterval?: NodeJS.Timeout;
}

/**
 * Check if event name matches a glob pattern.
 * Supports:
 * - `*` (match all)
 * - `prefix:*` (match all events starting with prefix:)
 * - Exact match
 * 
 * @param pattern - Glob pattern
 * @param eventName - Event name to match
 * @returns True if event matches pattern
 */
function matchesPattern(pattern: string, eventName: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -1); // Remove trailing *
    return eventName.startsWith(prefix);
  }
  return pattern === eventName;
}

/**
 * Attach WebSocket endpoint to Fastify server and bridge events from TypedEventBus.
 * 
 * Features:
 * - WebSocket endpoint on `/ws`
 * - Broadcast all EventBus events to connected clients
 * - Client-side event filtering via subscribe/unsubscribe with glob patterns
 * - Heartbeat ping every 30 seconds
 * - Connection tracking (clientId, connectedAt)
 * 
 * @param server - Fastify instance (must have @fastify/websocket registered)
 * @param eventBus - TypedEventBus instance
 */
export function attachWebSocket(
  server: FastifyInstance,
  eventBus: TypedEventBus<EventMap>
): void {
  const clients = new Map<string, ClientState>();

  /**
   * Broadcast an event to all connected clients that subscribed to it.
   */
  function broadcastEvent<K extends keyof EventMap>(
    event: K,
    payload: EventMap[K]
  ): void {
    const eventName = String(event);
    const message: EventMessage = {
      type: 'event',
      event: eventName,
      data: payload,
      timestamp: new Date().toISOString(),
    };

    const messageStr = JSON.stringify(message);

    for (const client of clients.values()) {
      // Check if client is subscribed to this event
      const isSubscribed = Array.from(client.subscribedEvents).some((pattern) =>
        matchesPattern(pattern, eventName)
      );

      if (isSubscribed && client.ws.readyState === 1) {
        // 1 = OPEN
        client.ws.send(messageStr);
      }
    }
  }

  // Register listeners for all event types
  const eventNames: (keyof EventMap)[] = [
    'run:start',
    'run:end',
    'run:error',
    'run:step',
    'tool:call',
    'tool:result',
    'llm:request',
    'llm:response',
    'plan:start',
    'plan:step:start',
    'plan:step:end',
    'plan:end',
  ];

  for (const eventName of eventNames) {
    eventBus.on(eventName, (payload) => {
      broadcastEvent(eventName, payload);
    });
  }

  // WebSocket endpoint
  server.get('/ws', { websocket: true }, (socket, _request) => {
    const clientId = randomUUID();
    const state: ClientState = {
      clientId,
      connectedAt: new Date(),
      subscribedEvents: new Set(['*']), // Default: subscribe to all
      ws: socket,
    };

    clients.set(clientId, state);

    // Send connection confirmation (wait for socket to be fully ready)
    setImmediate(() => {
      if (socket.readyState === 1) { // 1 = OPEN
        const connectedMsg: ConnectedMessage = {
          type: 'connected',
          clientId,
          subscribedEvents: Array.from(state.subscribedEvents),
        };
        socket.send(JSON.stringify(connectedMsg));
      }
    });

    // Setup heartbeat ping (every 30 seconds)
    state.pingInterval = setInterval(() => {
      if (socket.readyState === 1) {
        const pingMsg: PingMessage = { type: 'ping' };
        socket.send(JSON.stringify(pingMsg));
      }
    }, 30_000);

    // Handle incoming messages
    socket.on('message', (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString()) as ClientMessage;

        if (message.type === 'subscribe') {
          for (const pattern of message.events) {
            state.subscribedEvents.add(pattern);
          }
        } else if (message.type === 'unsubscribe') {
          for (const pattern of message.events) {
            state.subscribedEvents.delete(pattern);
          }
        }
      } catch (err) {
        server.log.warn({ err, clientId }, 'Failed to parse WebSocket message');
      }
    });

    // Cleanup on disconnect
    socket.on('close', () => {
      if (state.pingInterval) {
        clearInterval(state.pingInterval);
      }
      clients.delete(clientId);
      server.log.info({ clientId }, 'WebSocket client disconnected');
    });

    server.log.info({ clientId }, 'WebSocket client connected');
  });
}
