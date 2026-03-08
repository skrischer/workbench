// src/runtime/__tests__/token-tracker.test.ts — TokenTracker Unit Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenTracker } from '../token-tracker.js';

describe('TokenTracker', () => {
  let tracker: TokenTracker;

  beforeEach(() => {
    tracker = new TokenTracker();
  });

  it('should return all zeros for a new tracker', () => {
    const usage = tracker.getRunUsage();

    expect(usage.totalInputTokens).toBe(0);
    expect(usage.totalOutputTokens).toBe(0);
    expect(usage.totalCacheReadTokens).toBe(0);
    expect(usage.totalCacheWriteTokens).toBe(0);
    expect(usage.totalTokens).toBe(0);
    expect(usage.stepCount).toBe(0);
  });

  it('should accumulate token usage over multiple steps', () => {
    // Step 1
    tracker.recordStep({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
    });

    // Step 2
    tracker.recordStep({
      inputTokens: 200,
      outputTokens: 75,
      cacheReadTokens: 20,
      cacheWriteTokens: 15,
    });

    // Step 3
    tracker.recordStep({
      inputTokens: 150,
      outputTokens: 100,
      cacheReadTokens: 30,
      cacheWriteTokens: 10,
    });

    const usage = tracker.getRunUsage();

    expect(usage.totalInputTokens).toBe(450);
    expect(usage.totalOutputTokens).toBe(225);
    expect(usage.totalCacheReadTokens).toBe(60);
    expect(usage.totalCacheWriteTokens).toBe(30);
    expect(usage.totalTokens).toBe(675); // 450 + 225
    expect(usage.stepCount).toBe(3);
  });

  it('should treat missing cache fields as zero', () => {
    // Step without cache fields
    tracker.recordStep({
      inputTokens: 100,
      outputTokens: 50,
    });

    // Step with only cacheReadTokens
    tracker.recordStep({
      inputTokens: 200,
      outputTokens: 75,
      cacheReadTokens: 20,
    });

    // Step with only cacheWriteTokens
    tracker.recordStep({
      inputTokens: 150,
      outputTokens: 100,
      cacheWriteTokens: 10,
    });

    const usage = tracker.getRunUsage();

    expect(usage.totalInputTokens).toBe(450);
    expect(usage.totalOutputTokens).toBe(225);
    expect(usage.totalCacheReadTokens).toBe(20); // Only from step 2
    expect(usage.totalCacheWriteTokens).toBe(10); // Only from step 3
    expect(usage.totalTokens).toBe(675);
    expect(usage.stepCount).toBe(3);
  });

  it('should reset all counters to zero', () => {
    // Add some usage
    tracker.recordStep({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
    });

    tracker.recordStep({
      inputTokens: 200,
      outputTokens: 75,
    });

    // Verify it's not zero
    let usage = tracker.getRunUsage();
    expect(usage.stepCount).toBe(2);
    expect(usage.totalTokens).toBeGreaterThan(0);

    // Reset
    tracker.reset();

    // Verify everything is zero
    usage = tracker.getRunUsage();
    expect(usage.totalInputTokens).toBe(0);
    expect(usage.totalOutputTokens).toBe(0);
    expect(usage.totalCacheReadTokens).toBe(0);
    expect(usage.totalCacheWriteTokens).toBe(0);
    expect(usage.totalTokens).toBe(0);
    expect(usage.stepCount).toBe(0);
  });

  it('should accumulate correctly after reset', () => {
    // First accumulation
    tracker.recordStep({ inputTokens: 100, outputTokens: 50 });
    tracker.recordStep({ inputTokens: 100, outputTokens: 50 });

    expect(tracker.getRunUsage().stepCount).toBe(2);

    // Reset
    tracker.reset();

    // Second accumulation
    tracker.recordStep({ inputTokens: 200, outputTokens: 100 });

    const usage = tracker.getRunUsage();
    expect(usage.totalInputTokens).toBe(200);
    expect(usage.totalOutputTokens).toBe(100);
    expect(usage.totalTokens).toBe(300);
    expect(usage.stepCount).toBe(1);
  });
});
