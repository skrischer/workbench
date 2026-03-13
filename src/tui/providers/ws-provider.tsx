// src/tui/providers/ws-provider.tsx — TUI WebSocket Context Provider (uses `ws` package)

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import WebSocket from 'ws';
import type {
  WsCommand,
  CommandPayloadMap,
  ServerMessage,
  WsResponseMessage,
} from '../../types/ws-protocol.js';

// === Types ===

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface TuiWsContextValue {
  status: WsStatus;
  lastMessage: ServerMessage | null;
  send: <C extends WsCommand>(command: C, payload?: CommandPayloadMap[C]) => void;
  sendCommand: <C extends WsCommand>(
    command: C,
    payload?: CommandPayloadMap[C],
    timeoutMs?: number,
  ) => Promise<unknown>;
}

// === Context ===

const TuiWsContext = createContext<TuiWsContextValue | null>(null);

// === Constants ===

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const DEFAULT_COMMAND_TIMEOUT = 10000;

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// === Provider ===

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface TuiWsProviderProps {
  url: string;
  children: ReactNode;
}

export function TuiWsProvider({ url, children }: TuiWsProviderProps): React.ReactElement {
  const [status, setStatus] = useState<WsStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus('connecting');

    ws.on('open', () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      setStatus('open');
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    });

    ws.on('message', (raw: Buffer | string) => {
      if (unmountedRef.current) return;

      let msg: ServerMessage;
      try {
        msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8')) as ServerMessage;
      } catch {
        return;
      }

      // Resolve pending request/response if applicable
      if (msg.type === 'response') {
        const resp = msg as WsResponseMessage;
        if (resp.requestId) {
          const pending = pendingRef.current.get(resp.requestId);
          if (pending) {
            pendingRef.current.delete(resp.requestId);
            clearTimeout(pending.timer);
            if (resp.error) {
              pending.reject(new Error(`${resp.error.code}: ${resp.error.message}`));
            } else {
              pending.resolve(resp.data);
            }
          }
        }
      }

      setLastMessage(msg);
    });

    ws.on('error', () => {
      if (unmountedRef.current) return;
      setStatus('error');
    });

    ws.on('close', () => {
      if (unmountedRef.current) return;
      wsRef.current = null;
      setStatus('closed');

      // Reject all pending requests
      for (const [id, pending] of pendingRef.current) {
        clearTimeout(pending.timer);
        pending.reject(new Error('WebSocket closed'));
        pendingRef.current.delete(id);
      }

      // Schedule reconnect with exponential backoff
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);
      reconnectTimerRef.current = setTimeout(connect, delay);
    });
  }, [url]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      // Reject all pending requests
      for (const [id, pending] of pendingRef.current) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Provider unmounted'));
        pendingRef.current.delete(id);
      }
      if (wsRef.current) {
        wsRef.current.removeAllListeners('close'); // Prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback(
    <C extends WsCommand>(command: C, payload?: CommandPayloadMap[C]) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'command', command, payload }));
    },
    [],
  );

  const sendCommand = useCallback(
    <C extends WsCommand>(
      command: C,
      payload?: CommandPayloadMap[C],
      timeoutMs: number = DEFAULT_COMMAND_TIMEOUT,
    ): Promise<unknown> => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error('WebSocket not connected'));
      }

      const requestId = generateRequestId();

      return new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          pendingRef.current.delete(requestId);
          reject(new Error(`Command '${command}' timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        pendingRef.current.set(requestId, { resolve, reject, timer });

        ws.send(
          JSON.stringify({ type: 'command', command, requestId, payload }),
        );
      });
    },
    [],
  );

  const value: TuiWsContextValue = {
    status,
    lastMessage,
    send,
    sendCommand,
  };

  return <TuiWsContext.Provider value={value}>{children}</TuiWsContext.Provider>;
}

// === Hook ===

export function useTuiWs(): TuiWsContextValue {
  const ctx = useContext(TuiWsContext);
  if (!ctx) {
    throw new Error('useTuiWs must be used within a TuiWsProvider');
  }
  return ctx;
}
