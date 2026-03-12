// src/shared/ws-client/use-ws-command.ts — High-level command hook with request/response matching

import { useRef, useEffect, useCallback } from 'react';
import type { ServerMessage, WsCommand, WsResponseMessage } from '../../types/ws-protocol.js';
import type { UseWebSocketReturn } from './use-websocket.js';

const DEFAULT_TIMEOUT_MS = 10_000;

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface UseWsCommandReturn {
  sendCommand: (command: WsCommand, payload?: unknown) => Promise<unknown>;
}

export function useWsCommand(ws: UseWebSocketReturn): UseWsCommandReturn {
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());

  // Handle incoming responses
  useEffect(() => {
    const msg: ServerMessage | null = ws.lastMessage;
    if (!msg || msg.type !== 'response') return;

    const response = msg as WsResponseMessage;
    const pending = pendingRef.current.get(response.requestId);
    if (!pending) return;

    pendingRef.current.delete(response.requestId);
    clearTimeout(pending.timer);

    if (response.error) {
      pending.reject(new Error(`[${response.error.code}] ${response.error.message}`));
    } else {
      pending.resolve(response.data);
    }
  }, [ws.lastMessage]);

  // Clean up all pending requests on unmount
  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      for (const [, entry] of pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error('Component unmounted'));
      }
      pending.clear();
    };
  }, []);

  const sendCommand = useCallback(
    (command: WsCommand, payload?: unknown): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();

        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          reject(new Error(`Command '${command}' timed out after ${DEFAULT_TIMEOUT_MS}ms`));
        }, DEFAULT_TIMEOUT_MS);

        pendingRef.current.set(requestId, { resolve, reject, timer });
        ws.send(command, payload, requestId);
      });
    },
    [ws],
  );

  return { sendCommand };
}
