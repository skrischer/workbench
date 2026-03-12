// src/types/ws-protocol.ts — WebSocket Protocol Type Definitions

import type { EventMap } from './events.js';

// === Server → Client ===

/** EventBus event forwarded to client */
export interface WsEventMessage<K extends keyof EventMap = keyof EventMap> {
  type: 'event';
  event: K;
  data: EventMap[K];
}

/** Response to a client command */
export interface WsResponseMessage {
  type: 'response';
  requestId: string;
  data: unknown;
  error?: { code: string; message: string };
}

export type ServerMessage = WsEventMessage | WsResponseMessage;

// === Client → Server ===

export type WsCommand =
  | 'list_sessions'
  | 'load_session'
  | 'create_session'
  | 'send_message'
  | 'abort_run'
  | 'search_sessions';

/** Command from client to server */
export interface WsCommandMessage {
  type: 'command';
  command: WsCommand;
  requestId?: string;
  payload?: unknown;
}

export type ClientMessage = WsCommandMessage;

// === Type Guards ===

export function isWsCommandMessage(msg: unknown): msg is WsCommandMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as Record<string, unknown>).type === 'command' &&
    'command' in msg &&
    typeof (msg as Record<string, unknown>).command === 'string'
  );
}

export function isServerMessage(msg: unknown): msg is ServerMessage {
  if (typeof msg !== 'object' || msg === null || !('type' in msg)) return false;
  const type = (msg as Record<string, unknown>).type;
  return type === 'event' || type === 'response';
}

// === Command Payloads (typed per command) ===

export interface LoadSessionPayload {
  id: string;
}

export interface SendMessagePayload {
  sessionId: string;
  prompt: string;
}

export interface AbortRunPayload {
  runId: string;
}

export interface SearchSessionsPayload {
  query: string;
  limit?: number;
}

export type CommandPayloadMap = {
  list_sessions: undefined;
  load_session: LoadSessionPayload;
  create_session: undefined;
  send_message: SendMessagePayload;
  abort_run: AbortRunPayload;
  search_sessions: SearchSessionsPayload;
};
