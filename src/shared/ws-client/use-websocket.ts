// src/shared/ws-client/use-websocket.ts — Low-level WebSocket hook with auto-reconnect

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ServerMessage, WsCommand, WsCommandMessage } from '../../types/ws-protocol.js';
import { isServerMessage } from '../../types/ws-protocol.js';

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseWebSocketReturn {
  status: WsStatus;
  send: (command: WsCommand, payload?: unknown, requestId?: string) => void;
  lastMessage: ServerMessage | null;
}

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

export function useWebSocket(url: string): UseWebSocketReturn {
  const [status, setStatus] = useState<WsStatus>('connecting');
  const [lastMessage, setLastMessage] = useState<ServerMessage | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const send = useCallback(
    (command: WsCommand, payload?: unknown, requestId?: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const msg: WsCommandMessage = { type: 'command', command };
      if (payload !== undefined) msg.payload = payload;
      if (requestId !== undefined) msg.requestId = requestId;

      ws.send(JSON.stringify(msg));
    },
    [],
  );

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;
      setStatus('connecting');

      ws.addEventListener('open', () => {
        if (unmountedRef.current) { ws.close(); return; }
        retriesRef.current = 0;
        setStatus('connected');
      });

      ws.addEventListener('message', (ev: MessageEvent) => {
        if (unmountedRef.current) return;
        try {
          const parsed: unknown = JSON.parse(String(ev.data));
          if (isServerMessage(parsed)) {
            setLastMessage(parsed);
          }
        } catch {
          // Ignore non-JSON messages
        }
      });

      ws.addEventListener('close', () => {
        if (unmountedRef.current) return;
        wsRef.current = null;
        setStatus('disconnected');
        scheduleReconnect();
      });

      ws.addEventListener('error', () => {
        if (unmountedRef.current) return;
        setStatus('error');
        // The 'close' event will fire after 'error', triggering reconnect
      });
    }

    function scheduleReconnect() {
      if (unmountedRef.current) return;
      const delay = Math.min(MIN_BACKOFF_MS * 2 ** retriesRef.current, MAX_BACKOFF_MS);
      retriesRef.current += 1;
      reconnectTimerRef.current = setTimeout(connect, delay);
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const ws = wsRef.current;
      if (ws) {
        ws.close();
        wsRef.current = null;
      }
    };
  }, [url]);

  return { status, send, lastMessage };
}
