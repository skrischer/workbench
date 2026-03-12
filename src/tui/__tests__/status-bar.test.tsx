// src/tui/__tests__/status-bar.test.tsx — StatusBar tests

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar, shortModelName, formatTokenCount, formatResetTime } from '../components/status-bar.js';
import { TypedEventBus } from '../../events/event-bus.js';

/** Helper: wait for ink re-render after state update */
const tick = () => new Promise((r) => setTimeout(r, 50));

describe('StatusBar', () => {
  it('should render keyboard hints', () => {
    const eventBus = new TypedEventBus();
    const { lastFrame } = render(
      <StatusBar eventBus={eventBus} isRunning={false} />
    );
    const output = lastFrame();
    expect(output).toContain('Ctrl+B');
    expect(output).toContain('Ctrl+N');
    expect(output).toContain('Ctrl+C');
  });

  it('should show running indicator when active', () => {
    const eventBus = new TypedEventBus();
    const { lastFrame } = render(
      <StatusBar eventBus={eventBus} isRunning={true} />
    );
    expect(lastFrame()).toContain('Running');
  });

  it('should show short model name when provided', () => {
    const eventBus = new TypedEventBus();
    const { lastFrame } = render(
      <StatusBar eventBus={eventBus} isRunning={false} model="claude-sonnet-4-20250514" />
    );
    expect(lastFrame()).toContain('sonnet-4');
  });

  it('should update on llm:response events', async () => {
    const eventBus = new TypedEventBus();
    const { lastFrame } = render(
      <StatusBar eventBus={eventBus} isRunning={false} />
    );

    eventBus.emit('llm:response', {
      runId: 'test-run',
      model: 'claude-sonnet-4-20250514',
      tokenUsage: { inputTokens: 12000, outputTokens: 500 },
    });

    await tick();
    const output = lastFrame();
    expect(output).toContain('sonnet-4');
    expect(output).toContain('12k');
  });

  it('should show rate limit bars when available', async () => {
    const eventBus = new TypedEventBus();
    const { lastFrame } = render(
      <StatusBar eventBus={eventBus} isRunning={false} />
    );

    eventBus.emit('llm:response', {
      runId: 'test-run',
      model: 'claude-sonnet-4-20250514',
      tokenUsage: { inputTokens: 5000, outputTokens: 200 },
      rateLimit: {
        fiveHourUtilization: 0.09,
        fiveHourReset: Math.floor(Date.now() / 1000) + 7200,
        fiveHourStatus: 'allowed',
        sevenDayUtilization: 0.36,
        sevenDayReset: Math.floor(Date.now() / 1000) + 86400,
        sevenDayStatus: 'allowed',
      },
    });

    await tick();
    const output = lastFrame();
    expect(output).toContain('5h');
    expect(output).toContain('9%');
    expect(output).toContain('7d');
    expect(output).toContain('36%');
  });
});

describe('shortModelName', () => {
  it('should strip claude- prefix and date suffix', () => {
    expect(shortModelName('claude-sonnet-4-20250514')).toBe('sonnet-4');
    expect(shortModelName('claude-opus-4-20250514')).toBe('opus-4');
    expect(shortModelName('claude-3-5-sonnet-20241022')).toBe('3-5-sonnet');
    expect(shortModelName('claude-3-5-haiku-20241022')).toBe('3-5-haiku');
  });

  it('should handle already short names', () => {
    expect(shortModelName('sonnet-4')).toBe('sonnet-4');
  });
});

describe('formatTokenCount', () => {
  it('should format small numbers as-is', () => {
    expect(formatTokenCount(0)).toBe('0');
    expect(formatTokenCount(999)).toBe('999');
  });

  it('should format thousands as k', () => {
    expect(formatTokenCount(1000)).toBe('1.0k');
    expect(formatTokenCount(1500)).toBe('1.5k');
    expect(formatTokenCount(12000)).toBe('12k');
    expect(formatTokenCount(99500)).toBe('100k');
  });

  it('should format millions as M', () => {
    expect(formatTokenCount(1_000_000)).toBe('1.0M');
    expect(formatTokenCount(1_500_000)).toBe('1.5M');
    expect(formatTokenCount(10_000_000)).toBe('10M');
  });
});

describe('formatResetTime', () => {
  it('should return empty string for 0', () => {
    expect(formatResetTime(0)).toBe('');
  });

  it('should return "now" for past timestamps', () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    expect(formatResetTime(past)).toBe('now');
  });

  it('should format minutes for short durations', () => {
    const inThirtyMin = Math.floor(Date.now() / 1000) + 30 * 60;
    expect(formatResetTime(inThirtyMin)).toMatch(/^~30m$/);
  });

  it('should format hours+minutes for medium durations', () => {
    const inNinetyMin = Math.floor(Date.now() / 1000) + 90 * 60;
    expect(formatResetTime(inNinetyMin)).toMatch(/^~1h30m$/);
  });

  it('should format as day+time for long durations', () => {
    const inTwoDays = Math.floor(Date.now() / 1000) + 48 * 3600;
    const result = formatResetTime(inTwoDays);
    expect(result).toMatch(/^(So|Mo|Di|Mi|Do|Fr|Sa) \d{2}:\d{2}$/);
  });
});
