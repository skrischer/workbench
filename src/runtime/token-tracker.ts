// src/runtime/token-tracker.ts — Token Usage Tracker

import type { StepTokenUsage, RunTokenUsage } from '../types/tokens.js';

/**
 * TokenTracker accumulates token usage across multiple LLM steps.
 * Tracks input, output, cache-read, and cache-write tokens.
 */
export class TokenTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalCacheReadTokens = 0;
  private totalCacheWriteTokens = 0;
  private stepCount = 0;

  /**
   * Record token usage from a single LLM step.
   * Optional cache fields default to 0 if not provided.
   */
  recordStep(step: StepTokenUsage): void {
    this.totalInputTokens += step.inputTokens;
    this.totalOutputTokens += step.outputTokens;
    this.totalCacheReadTokens += step.cacheReadTokens ?? 0;
    this.totalCacheWriteTokens += step.cacheWriteTokens ?? 0;
    this.stepCount++;
  }

  /**
   * Get cumulative token usage across all recorded steps.
   */
  getRunUsage(): RunTokenUsage {
    return {
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      totalCacheReadTokens: this.totalCacheReadTokens,
      totalCacheWriteTokens: this.totalCacheWriteTokens,
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      stepCount: this.stepCount,
    };
  }

  /**
   * Reset all counters to zero.
   */
  reset(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalCacheReadTokens = 0;
    this.totalCacheWriteTokens = 0;
    this.stepCount = 0;
  }
}
