// src/tui/__tests__/chat-input.test.tsx — Chat input tests

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ChatInput } from '../components/chat-input.js';

describe('ChatInput', () => {
  it('should render input prompt', () => {
    const { lastFrame } = render(
      <ChatInput onSubmit={() => {}} />
    );
    expect(lastFrame()).toContain('>');
  });

  it('should show disabled state when running', () => {
    const { lastFrame } = render(
      <ChatInput onSubmit={() => {}} disabled={true} />
    );
    expect(lastFrame()).toContain('running');
  });

  it('should accept text input', async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <ChatInput onSubmit={onSubmit} />
    );

    // Type text
    stdin.write('hello');

    // Wait for ink to re-render with the typed text
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('hello');
    });
  });

  it('should not submit empty input', () => {
    const onSubmit = vi.fn();
    const { stdin } = render(
      <ChatInput onSubmit={onSubmit} />
    );

    // Submit without typing
    stdin.write('\r');

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
