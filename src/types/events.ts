// src/types/events.ts — Event Bus Type Definitions

import type { AgentConfig, Message, ToolResult } from './index.js';

/** Token usage statistics */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** Token usage for a single step */
export interface StepTokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Central event map for typed event bus */
export interface EventMap {
  'run:start': { runId: string; agentConfig: AgentConfig; prompt: string };
  'run:end': { runId: string; result: string; tokenUsage: TokenUsage };
  'run:error': { runId: string; error: string };
  'run:step': { runId: string; stepIndex: number; message: Message };
  'tool:call': { runId: string; toolName: string; input: unknown; stepIndex: number };
  'tool:result': { runId: string; toolName: string; result: ToolResult; durationMs: number };
  'llm:request': { runId: string; model: string; messageCount: number };
  'llm:response': { runId: string; model: string; tokenUsage: StepTokenUsage };
  'agent:spawned': { id: string; role: string; sessionId: string };
  'agent:status': { id: string; status: string; previousStatus?: string };
  'agent:terminated': { id: string; role: string };
  'message:sent': { from: string; to: string; type: string; payload: unknown };
  'message:received': { agentId: string; from: string; to: string; type: string; payload: unknown };
  'memory:added': { id: string; type: string; tags: string[] };
  'memory:searched': { query: string; resultCount: number };
  'memory:summarized': { sessionId: string; summaryId: string; messageCount: number };
  'model:fallback:triggered': { from: string; to: string; reason: string; statusCode?: number; timestamp: string };
  'model:fallback:exhausted': { attemptedModels: string[]; finalError: string; timestamp: string };
  'model:cooldown:start': { model: string; durationMs: number; expiresAt: string; reason: string };
  'session:message': { sessionId: string; message: Message };
  'llm:stream:delta': { runId: string; text: string };
  'llm:stream:tool_start': { runId: string; toolName: string; toolId: string };
  'llm:stream:tool_input': { runId: string; toolId: string; inputDelta: string };
  'llm:stream:stop': { runId: string };
}

/** Event listener function */
export type EventListener<T> = (payload: T) => void;

/** Unsubscribe function returned by event listeners */
export type Unsubscribe = () => void;
