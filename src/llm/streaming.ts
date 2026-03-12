// src/llm/streaming.ts — Streaming response types

/** Individual delta from the streaming API */
export interface StreamDelta {
  type: 'text_delta' | 'tool_use_start' | 'tool_input_delta' | 'content_block_stop' | 'message_stop';
  text?: string;
  toolName?: string;
  toolId?: string;
  inputDelta?: string;
}

/** Streaming response wrapping an async iterator of deltas */
export interface StreamingResponse {
  [Symbol.asyncIterator](): AsyncIterator<StreamDelta>;
  abort(): void;
}
