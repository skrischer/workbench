// src/tui/__tests__/use-agent-loop.test.ts — useAgentLoop hook tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { TypedEventBus } from '../../events/event-bus.js';
import { SessionStorage } from '../../storage/session-storage.js';
import type { AgentLoop } from '../../runtime/agent-loop.js';
import { useAgentLoop } from '../hooks/use-agent-loop.js';

// Mock SessionStorage
vi.mock('../../storage/session-storage.js', () => {
  const MockSessionStorage = vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue({ data: [], total: 0, offset: 0, limit: 50 }),
    load: vi.fn(),
    createSession: vi.fn(),
    save: vi.fn(),
  }));
  return { SessionStorage: MockSessionStorage };
});

// Mock heavy dependencies to avoid actual init
vi.mock('../../agent/config.js', () => ({
  loadAgentConfig: vi.fn().mockResolvedValue({
    model: 'claude-sonnet-4-20250514',
    systemPrompt: 'test',
    maxSteps: 10,
    tools: [],
  }),
}));

vi.mock('../../llm/token-storage.js', () => {
  const MockTokenStorage = vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue({
      anthropic: { type: 'oauth', access: 'tok', refresh: 'ref', expires: Date.now() + 3600000 },
    }),
  }));
  return { TokenStorage: MockTokenStorage };
});

vi.mock('../../llm/token-refresh.js', () => {
  const MockTokenRefresher = vi.fn().mockImplementation(() => ({
    ensureValidToken: vi.fn().mockResolvedValue('tok'),
  }));
  return { TokenRefresher: MockTokenRefresher };
});

vi.mock('../../llm/anthropic-client.js', () => {
  const MockAnthropicClient = vi.fn().mockImplementation(() => ({}));
  return { AnthropicClient: MockAnthropicClient };
});

vi.mock('../../runtime/agent-loop.js', () => {
  const MockAgentLoop = vi.fn().mockImplementation(() => ({
    runStreaming: vi.fn(),
    cancel: vi.fn(),
    run: vi.fn(),
  }));
  return { AgentLoop: MockAgentLoop };
});

vi.mock('../../tools/defaults.js', () => ({
  createDefaultTools: vi.fn().mockReturnValue({
    list: vi.fn().mockReturnValue(['read_file', 'write_file', 'exec']),
    get: vi.fn(),
    has: vi.fn(),
    register: vi.fn(),
    registerAlias: vi.fn(),
  }),
}));

/** Wrapper component that renders hook state as text for testing */
function HookTester({
  eventBus,
  sessionStorage,
  injectedAgentLoop,
}: {
  eventBus: TypedEventBus;
  sessionStorage: SessionStorage;
  injectedAgentLoop?: AgentLoop | null;
}): React.ReactElement {
  const { agentLoop, isInitializing, initError } = useAgentLoop(eventBus, sessionStorage, injectedAgentLoop);
  return React.createElement(Text, null,
    `loop:${agentLoop ? 'yes' : 'no'} init:${isInitializing} err:${initError ?? 'none'}`
  );
}

describe('useAgentLoop', () => {
  let eventBus: TypedEventBus;
  let sessionStorage: SessionStorage;

  beforeEach(() => {
    vi.clearAllMocks();
    eventBus = new TypedEventBus();
    sessionStorage = new SessionStorage();
  });

  it('should skip initialization when injectedAgentLoop is provided', () => {
    const mockLoop = { runStreaming: vi.fn(), cancel: vi.fn() } as unknown as AgentLoop;

    const { lastFrame } = render(
      React.createElement(HookTester, { eventBus, sessionStorage, injectedAgentLoop: mockLoop })
    );

    expect(lastFrame()).toContain('loop:yes');
    expect(lastFrame()).toContain('init:false');
    expect(lastFrame()).toContain('err:none');
  });

  it('should skip initialization when injectedAgentLoop is null', () => {
    const { lastFrame } = render(
      React.createElement(HookTester, { eventBus, sessionStorage, injectedAgentLoop: null })
    );

    expect(lastFrame()).toContain('loop:no');
    expect(lastFrame()).toContain('init:false');
    expect(lastFrame()).toContain('err:none');
  });

  it('should start with isInitializing=true when no injection', () => {
    const { lastFrame } = render(
      React.createElement(HookTester, { eventBus, sessionStorage })
    );

    // On first render, isInitializing should be true
    expect(lastFrame()).toContain('init:true');
  });

  it('should complete initialization and create AgentLoop', async () => {
    const { lastFrame } = render(
      React.createElement(HookTester, { eventBus, sessionStorage })
    );

    // Wait for async init to complete
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('init:false');
    });

    expect(lastFrame()).toContain('loop:yes');
    expect(lastFrame()).toContain('err:none');
  });
});
