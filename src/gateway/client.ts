// src/gateway/client.ts — Node.js WebSocket Client for Gateway

import WebSocket from 'ws';
import type {
  WsCommand,
  CommandPayloadMap,
  ServerMessage,
  WsEventMessage,
  WsResponseMessage,
} from '../types/ws-protocol.js';
import { getGatewayWsUrl } from './health.js';

const DEFAULT_COMMAND_TIMEOUT = 10000;

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface GatewayClient {
  /** Send a command and wait for response */
  sendCommand<C extends WsCommand>(
    command: C,
    payload?: CommandPayloadMap[C],
    timeoutMs?: number,
  ): Promise<unknown>;

  /** Fire-and-forget command (no response expected) */
  send<C extends WsCommand>(command: C, payload?: CommandPayloadMap[C]): void;

  /** Subscribe to EventBus events forwarded by the Gateway */
  onEvent(handler: (msg: WsEventMessage) => void): () => void;

  /** Subscribe to all server messages (events + responses) */
  onMessage(handler: (msg: ServerMessage) => void): () => void;

  /** Subscribe to WebSocket close events */
  onClose(handler: (code: number, reason: string) => void): () => void;

  /** Close the WebSocket connection */
  close(): void;

  /** Whether the WebSocket is currently connected */
  readonly connected: boolean;
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Connect to a running Gateway instance via WebSocket.
 * Returns a Promise that resolves once the connection is open.
 *
 * No auto-reconnect — CLI clients are short-lived.
 * On error, the returned promise rejects.
 */
export function connectToGateway(url?: string): Promise<GatewayClient> {
  const wsUrl = url ?? getGatewayWsUrl();

  return new Promise<GatewayClient>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map<string, PendingRequest>();
    const eventHandlers = new Set<(msg: WsEventMessage) => void>();
    const messageHandlers = new Set<(msg: ServerMessage) => void>();
    const closeHandlers = new Set<(code: number, reason: string) => void>();
    let closed = false;

    ws.on('open', () => {
      const client: GatewayClient = {
        get connected() {
          return ws.readyState === WebSocket.OPEN;
        },

        sendCommand<C extends WsCommand>(
          command: C,
          payload?: CommandPayloadMap[C],
          timeoutMs: number = DEFAULT_COMMAND_TIMEOUT,
        ): Promise<unknown> {
          if (ws.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('WebSocket not connected'));
          }

          const requestId = generateRequestId();

          return new Promise<unknown>((res, rej) => {
            const timer = setTimeout(() => {
              pending.delete(requestId);
              rej(new Error(`Command '${command}' timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            pending.set(requestId, { resolve: res, reject: rej, timer });
            ws.send(JSON.stringify({ type: 'command', command, requestId, payload }));
          });
        },

        send<C extends WsCommand>(command: C, payload?: CommandPayloadMap[C]): void {
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(JSON.stringify({ type: 'command', command, payload }));
        },

        onEvent(handler: (msg: WsEventMessage) => void): () => void {
          eventHandlers.add(handler);
          return () => { eventHandlers.delete(handler); };
        },

        onMessage(handler: (msg: ServerMessage) => void): () => void {
          messageHandlers.add(handler);
          return () => { messageHandlers.delete(handler); };
        },

        onClose(handler: (code: number, reason: string) => void): () => void {
          closeHandlers.add(handler);
          return () => { closeHandlers.delete(handler); };
        },

        close(): void {
          if (closed) return;
          closed = true;
          // Reject all pending requests
          for (const [id, p] of pending) {
            clearTimeout(p.timer);
            p.reject(new Error('Client closed'));
            pending.delete(id);
          }
          ws.close();
        },
      };

      resolve(client);
    });

    ws.on('message', (raw: Buffer | string) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8')) as ServerMessage;
      } catch {
        return;
      }

      // Notify message handlers
      for (const handler of messageHandlers) {
        handler(msg);
      }

      // Resolve pending requests
      if (msg.type === 'response') {
        const resp = msg as WsResponseMessage;
        if (resp.requestId) {
          const p = pending.get(resp.requestId);
          if (p) {
            pending.delete(resp.requestId);
            clearTimeout(p.timer);
            if (resp.error) {
              p.reject(new Error(`${resp.error.code}: ${resp.error.message}`));
            } else {
              p.resolve(resp.data);
            }
          }
        }
      }

      // Forward events
      if (msg.type === 'event') {
        const eventMsg = msg as WsEventMessage;
        for (const handler of eventHandlers) {
          handler(eventMsg);
        }
      }
    });

    ws.on('error', (err: Error) => {
      if (!closed) {
        reject(new Error(`Gateway connection failed: ${err.message}`));
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      closed = true;
      const reasonStr = reason.toString('utf-8');
      // Reject all pending requests
      for (const [id, p] of pending) {
        clearTimeout(p.timer);
        p.reject(new Error('WebSocket closed'));
        pending.delete(id);
      }
      // Notify close handlers
      for (const handler of closeHandlers) {
        handler(code, reasonStr);
      }
    });
  });
}
