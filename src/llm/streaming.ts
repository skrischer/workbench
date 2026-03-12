// src/llm/streaming.ts — Streaming response types

import type { RateLimitInfo } from '../types/events.js';

/** Individual delta from the streaming API (discriminated union) */
export type StreamDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; toolName: string; toolId: string }
  | { type: 'tool_input_delta'; inputDelta: string }
  | { type: 'content_block_stop' }
  | { type: 'message_start'; inputTokens: number; model: string }
  | { type: 'message_delta'; outputTokens: number; stopReason: string }
  | { type: 'message_stop' };

/** Streaming response wrapping an async iterator of deltas */
export interface StreamingResponse {
  [Symbol.asyncIterator](): AsyncIterator<StreamDelta>;
  abort(): void;
  rateLimit?: RateLimitInfo;
}
