// src/tui/__tests__/status-bar.test.tsx — StatusBar tests (Gateway client)

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar, shortModelName, formatTokenCount } from '../components/status-bar.js';

describe('StatusBar', () => {
  it('should render keyboard hints', () => {
    const { lastFrame } = render(
      <StatusBar isRunning={false} />
    );
    const output = lastFrame();
    expect(output).toContain('Ctrl+B');
    expect(output).toContain('Ctrl+N');
    expect(output).toContain('Ctrl+C');
  });

  it('should show running indicator when active', () => {
    const { lastFrame } = render(
      <StatusBar isRunning={true} />
    );
    expect(lastFrame()).toContain('Running');
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
