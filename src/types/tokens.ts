// src/types/tokens.ts — Token Tracking Type Definitions

/**
 * Token usage for a single LLM step/call.
 * Cache fields are optional — if missing, treated as 0.
 */
export interface StepTokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * Cumulative token usage across an entire run.
 * Aggregates all steps.
 */
export interface RunTokenUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  /** Total tokens = totalInputTokens + totalOutputTokens */
  totalTokens: number;
  stepCount: number;
}
