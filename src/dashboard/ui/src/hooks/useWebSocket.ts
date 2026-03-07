// src/dashboard/ui/src/hooks/useWebSocket.ts — React WebSocket Hook

import { useEffect, useRef, useCallback, useState } from 'react';
import type { EventMap } from '../../../../types/events.js';

/**
 * WebSocket server message types
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
 * WebSocket client message types
 */
interface SubscribeMessage {
  type: 'subscribe';
  events: string[];
}

/**
 * Event listener callback
 */
export type EventListener<K extends keyof EventMap> = (payload: EventMap[K]) => void;

/**
 * Subscription object
 */
interface Subscription {
  pattern: string;
  callback: (event: string, data: unknown) => void;
}

/**
 * Check if event name matches a glob pattern
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
 * Get WebSocket URL from environment or default
 */
function getWebSocketUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  
  // Auto-detect from current location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
}

export interface UseWebSocketResult {
  connected: boolean;
  clientId: string | null;
  subscribe: <K extends keyof EventMap>(
    pattern: K | string,
    callback: EventListener<K>
  ) => () => void;
}

/**
 * React hook for WebSocket connection with auto-reconnect
 * 
 * Features:
 * - Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s)
 * - Event subscription with glob patterns
 * - Typed events matching EventMap
 * - Automatic cleanup on unmount
 * 
 * @returns { connected, clientId, subscribe }
 * 
 * @example
 * ```tsx
 * const { connected, subscribe } = useWebSocket();
 * 
 * useEffect(() => {
 *   const unsubscribe = subscribe('run:*', (payload) => {
 *     console.log('Run event:', payload);
 *   });
 *   return unsubscribe;
 * }, [subscribe]);
 * ```
 */
export function useWebSocket(): UseWebSocketResult {
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<Set<Subscription>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectDelayRef = useRef<number>(1000); // Start at 1 second
  const intentionalCloseRef = useRef<boolean>(false);

  /**
   * Send subscribe message to server
   */
  const sendSubscribe = useCallback((patterns: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: SubscribeMessage = { type: 'subscribe', events: patterns };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = getWebSocketUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectDelayRef.current = 1000; // Reset backoff on successful connection
      
      // Re-subscribe to all active patterns
      const patterns = Array.from(
        new Set(Array.from(subscriptionsRef.current).map(sub => sub.pattern))
      );
      if (patterns.length > 0) {
        sendSubscribe(patterns);
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;

        if (message.type === 'connected') {
          setClientId(message.clientId);
        } else if (message.type === 'event') {
          // Dispatch to matching subscribers
          const eventName = message.event;
          const payload = message.data;

          for (const sub of subscriptionsRef.current) {
            if (matchesPattern(sub.pattern, eventName)) {
              sub.callback(eventName, payload);
            }
          }
        }
        // Ignore ping messages
      } catch (err) {
        console.warn('Failed to parse WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      setConnected(false);
      setClientId(null);
      wsRef.current = null;

      // Auto-reconnect with exponential backoff (unless intentional close)
      if (!intentionalCloseRef.current) {
        const delay = reconnectDelayRef.current;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);

        // Increase backoff (max 30 seconds)
        reconnectDelayRef.current = Math.min(delay * 2, 30000);
      }
    };
  }, [sendSubscribe]);

  /**
   * Subscribe to events matching a pattern
   */
  const subscribe = useCallback(
    <K extends keyof EventMap>(
      pattern: K | string,
      callback: EventListener<K>
    ): (() => void) => {
      const patternStr = String(pattern);
      
      const subscription: Subscription = {
        pattern: patternStr,
        callback: (_event, data) => {
          // Type-safe callback invocation
          callback(data as EventMap[K]);
        },
      };

      subscriptionsRef.current.add(subscription);

      // Tell server to subscribe to this pattern
      sendSubscribe([patternStr]);

      // Return unsubscribe function
      return () => {
        subscriptionsRef.current.delete(subscription);
      };
    },
    [sendSubscribe]
  );

  // Initial connection
  useEffect(() => {
    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { connected, clientId, subscribe };
}
