// src/types/run.ts — Run Logger Type Definitions

import type { TokenUsage } from './events.js';

/** Run status */
export type RunLogStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/** Run metadata stored in run.json */
export interface RunMetadata {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: RunLogStatus;
  prompt: string;
  tokenUsage?: TokenUsage;
}

/** Message entry for messages.json */
export interface RunMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: string[];
  stepIndex: number;
}

/** Tool call entry for tool-calls.json */
export interface RunToolCall {
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  durationMs: number;
  stepIndex: number;
}

/** Complete run log (in-memory representation) */
export interface RunLog {
  metadata: RunMetadata;
  messages: RunMessage[];
  toolCalls: RunToolCall[];
}
