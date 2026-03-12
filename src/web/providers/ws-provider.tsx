// src/web/providers/ws-provider.tsx — WebSocket Context Provider
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type {
  WsCommand,
  CommandPayloadMap,
  ServerMessage,
} from '../../types/ws-protocol.js';

// === Types ===

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface WsContextValue {
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

const WsContext = createContext<WsContextValue | null>(null);

// === Constants ===

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const DEFAULT_COMMAND_TIMEOUT = 10000;

// === Helpers ===

function buildWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// === Provider ===

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function WsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WsStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const url = buildWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }
      setStatus('open');
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    };

    ws.onmessage = (event: MessageEvent) => {
      if (unmountedRef.current) return;

      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return;
      }

      // Resolve pending request/response if applicable
      if (msg.type === 'response' && msg.requestId) {
        const pending = pendingRef.current.get(msg.requestId);
        if (pending) {
          pendingRef.current.delete(msg.requestId);
          clearTimeout(pending.timer);
          if (msg.error) {
            pending.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
          } else {
            pending.resolve(msg.data);
          }
        }
      }

      setLastMessage(msg);
    };

    ws.onerror = () => {
      if (unmountedRef.current) return;
      setStatus('error');
    };

    ws.onclose = () => {
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
    };
  }, []);

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
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
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

  const value: WsContextValue = {
    status,
    lastMessage,
    send,
    sendCommand,
  };

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

// === Hook ===

export function useWs(): WsContextValue {
  const ctx = useContext(WsContext);
  if (!ctx) {
    throw new Error('useWs must be used within a WsProvider');
  }
  return ctx;
}
