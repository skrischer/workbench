// src/tui/__tests__/status-bar.test.tsx — StatusBar tests

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBar } from '../components/status-bar.js';
import { TypedEventBus } from '../../events/event-bus.js';

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

  it('should show model name when provided', () => {
    const eventBus = new TypedEventBus();
    const { lastFrame } = render(
      <StatusBar eventBus={eventBus} isRunning={false} model="claude-sonnet-4-6" />
    );
    expect(lastFrame()).toContain('claude-sonnet-4-6');
  });

  it('should show token counts', () => {
    const eventBus = new TypedEventBus();
    const { lastFrame } = render(
      <StatusBar eventBus={eventBus} isRunning={false} />
    );
    expect(lastFrame()).toContain('Tokens:');
  });
});
