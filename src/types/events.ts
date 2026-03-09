// src/types/events.ts — Event Bus Type Definitions

import type { AgentConfig, Message, ToolResult } from './index.js';
import type { PlanStatus, StepStatus } from './task.js';

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
  'plan:start': { planId: string; title: string; stepCount: number };
  'plan:step:start': { planId: string; stepId: string; stepIndex: number; stepTitle: string };
  'plan:step:end': { planId: string; stepId: string; stepIndex: number; status: StepStatus; durationMs: number };
  'plan:end': { planId: string; status: PlanStatus; totalSteps: number; completedSteps: number };
  'agent:spawned': { id: string; role: string; sessionId: string };
  'agent:status': { id: string; status: string; previousStatus?: string };
  'agent:terminated': { id: string; role: string };
  'message:sent': { from: string; to: string; type: string; payload: unknown };
  'message:received': { agentId: string; from: string; to: string; type: string; payload: unknown };
  'workflow:start': { workflowId: string; sessionId: string; input: Record<string, unknown> };
  'workflow:end': { workflowId: string; sessionId: string; status: 'completed' | 'failed'; durationMs: number };
  'memory:added': { id: string; type: string; tags: string[] };
  'memory:searched': { query: string; resultCount: number };
  'memory:summarized': { sessionId: string; summaryId: string; messageCount: number };
}

/** Event listener function */
export type EventListener<T> = (payload: T) => void;

/** Unsubscribe function returned by event listeners */
export type Unsubscribe = () => void;
