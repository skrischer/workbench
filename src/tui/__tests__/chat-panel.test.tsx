// src/tui/__tests__/chat-panel.test.tsx — Chat panel tests

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ChatPanel } from '../components/chat-panel.js';
import { RuntimeContext, type RuntimeState } from '../context.js';
import type { ChatMessage } from '../types.js';

const defaultRuntime: RuntimeState = {
  runId: null,
  isRunning: false,
  abort: () => {},
};

describe('ChatPanel', () => {
  it('should show placeholder when no session is active', () => {
    const { lastFrame } = render(
      <RuntimeContext.Provider value={defaultRuntime}>
        <ChatPanel
          messages={[]}
          onSendMessage={() => {}}
          hasActiveSession={false}
        />
      </RuntimeContext.Provider>
    );

    expect(lastFrame()).toContain('Ctrl+N');
  });

  it('should display messages when session is active', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello', timestamp: '2026-03-10T10:00:00Z' },
      { role: 'assistant', content: 'Hi there!', timestamp: '2026-03-10T10:00:01Z' },
    ];

    const { lastFrame } = render(
      <RuntimeContext.Provider value={defaultRuntime}>
        <ChatPanel
          messages={messages}
          onSendMessage={() => {}}
          hasActiveSession={true}
        />
      </RuntimeContext.Provider>
    );

    const output = lastFrame();
    expect(output).toContain('Hello');
    expect(output).toContain('Hi there!');
    expect(output).toContain('You');
    expect(output).toContain('Assistant');
  });

  it('should show running indicator when agent is running', () => {
    const runningRuntime: RuntimeState = {
      runId: 'run-1',
      isRunning: true,
      abort: () => {},
    };

    const { lastFrame } = render(
      <RuntimeContext.Provider value={runningRuntime}>
        <ChatPanel
          messages={[]}
          onSendMessage={() => {}}
          hasActiveSession={true}
        />
      </RuntimeContext.Provider>
    );

    expect(lastFrame()).toContain('running');
  });

  it('should show streaming text with cursor', () => {
    const { lastFrame } = render(
      <RuntimeContext.Provider value={defaultRuntime}>
        <ChatPanel
          messages={[]}
          streamingText="Hello, I am"
          onSendMessage={() => {}}
          hasActiveSession={true}
        />
      </RuntimeContext.Provider>
    );

    const output = lastFrame();
    expect(output).toContain('Hello, I am');
    expect(output).toContain('▌');
  });
});
