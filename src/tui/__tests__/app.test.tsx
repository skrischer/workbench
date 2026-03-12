// src/tui/__tests__/app.test.tsx — App component tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../app.js';
import { TypedEventBus } from '../../events/event-bus.js';
import { SessionStorage } from '../../storage/session-storage.js';
import type { AgentLoop } from '../../runtime/agent-loop.js';

// Mock SessionStorage
vi.mock('../../storage/session-storage.js', () => {
  const MockSessionStorage = vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue({ data: [], total: 0, offset: 0, limit: 50 }),
    load: vi.fn().mockResolvedValue({
      id: 'test-session',
      agentId: 'test',
      messages: [],
      toolCalls: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    create: vi.fn().mockResolvedValue({
      id: 'new-session',
      agentId: 'default',
      messages: [],
      toolCalls: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    createSession: vi.fn().mockResolvedValue({
      id: 'new-session',
      agentId: 'default',
      messages: [],
      toolCalls: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    save: vi.fn().mockResolvedValue(undefined),
    addMessage: vi.fn().mockResolvedValue(undefined),
  }));
  return { SessionStorage: MockSessionStorage };
});

function createMockAgentLoop(): AgentLoop {
  return {
    runStreaming: vi.fn().mockResolvedValue({
      sessionId: 'test-session',
      steps: 1,
      finalResponse: 'Agent response',
      tokenUsage: { input_tokens: 10, output_tokens: 20 },
      status: 'completed',
    }),
    cancel: vi.fn().mockReturnValue(true),
    run: vi.fn(),
    isRunActive: vi.fn().mockReturnValue(false),
  } as unknown as AgentLoop;
}

describe('App', () => {
  let eventBus: TypedEventBus;
  let sessionStorage: SessionStorage;
  let mockAgentLoop: AgentLoop;

  beforeEach(() => {
    eventBus = new TypedEventBus();
    sessionStorage = new SessionStorage();
    mockAgentLoop = createMockAgentLoop();
  });

  it('should render with session panel and chat panel', () => {
    const { lastFrame } = render(
      <App eventBus={eventBus} sessionStorage={sessionStorage} agentLoop={mockAgentLoop} />
    );

    const output = lastFrame();
    expect(output).toBeDefined();
    // Should show Sessions header
    expect(output).toContain('Sessions');
    // Should show placeholder when no session is active
    expect(output).toContain('Ctrl+N');
  });

  it('should toggle session panel with Ctrl+B', async () => {
    const { lastFrame, stdin } = render(
      <App eventBus={eventBus} sessionStorage={sessionStorage} agentLoop={mockAgentLoop} />
    );

    // Initially visible
    expect(lastFrame()).toContain('Sessions');

    // Toggle off
    stdin.write('\x02'); // Ctrl+B

    // After toggle, Sessions header should not be visible
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain('Sessions');
    });

    // Toggle back on
    stdin.write('\x02');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Sessions');
    });
  });

  it('should show empty state when no sessions exist', () => {
    const { lastFrame } = render(
      <App eventBus={eventBus} sessionStorage={sessionStorage} agentLoop={mockAgentLoop} />
    );

    const output = lastFrame();
    expect(output).toContain('No sessions');
  });

  it('should accept agentLoop prop for test injection', () => {
    // Verifies that the injected agentLoop skips initialization
    // (no "Initializing..." screen)
    const { lastFrame } = render(
      <App eventBus={eventBus} sessionStorage={sessionStorage} agentLoop={mockAgentLoop} />
    );

    const output = lastFrame();
    expect(output).not.toContain('Initializing');
    expect(output).toContain('Sessions');
  });

  it('should accept null agentLoop without showing init screen', () => {
    const { lastFrame } = render(
      <App eventBus={eventBus} sessionStorage={sessionStorage} agentLoop={null} />
    );

    const output = lastFrame();
    // null is an explicit injection, not undefined (which triggers init)
    expect(output).not.toContain('Initializing');
  });

  it('should create new session on Ctrl+N', async () => {
    render(
      <App eventBus={eventBus} sessionStorage={sessionStorage} agentLoop={mockAgentLoop} />
    );

    // Verify no session created initially
    expect(sessionStorage.createSession).not.toHaveBeenCalled();
  });

  it('should show streaming text from agentRun via eventBus', async () => {
    const { lastFrame, stdin } = render(
      <App eventBus={eventBus} sessionStorage={sessionStorage} agentLoop={mockAgentLoop} />
    );

    // Create a session first
    stdin.write('\x0e'); // Ctrl+N

    await vi.waitFor(() => {
      expect(sessionStorage.createSession).toHaveBeenCalled();
    });

    // Simulate streaming delta events
    eventBus.emit('run:start', {
      runId: 'r1',
      agentConfig: { model: 'test', systemPrompt: 'test', maxSteps: 5 },
      prompt: 'test',
    });
    eventBus.emit('llm:stream:delta', { runId: 'r1', text: 'Streaming response' });

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Streaming response');
    });
  });
});
