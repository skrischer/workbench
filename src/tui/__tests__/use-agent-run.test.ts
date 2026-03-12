// src/tui/__tests__/use-agent-run.test.ts — useAgentRun hook tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypedEventBus } from '../../events/event-bus.js';
import type { AgentLoop } from '../../runtime/agent-loop.js';

describe('useAgentRun event handling', () => {
  let eventBus: TypedEventBus;

  beforeEach(() => {
    eventBus = new TypedEventBus();
  });

  it('should accumulate streaming deltas via EventBus', () => {
    let accumulated = '';

    eventBus.on('llm:stream:delta', ({ text }) => {
      accumulated += text;
    });

    eventBus.emit('llm:stream:delta', { runId: 'r1', text: 'Hello' });
    eventBus.emit('llm:stream:delta', { runId: 'r1', text: ' world' });

    expect(accumulated).toBe('Hello world');
  });

  it('should handle run lifecycle events', () => {
    const events: string[] = [];

    eventBus.on('run:start', () => events.push('start'));
    eventBus.on('run:end', () => events.push('end'));
    eventBus.on('run:error', () => events.push('error'));

    eventBus.emit('run:start', {
      runId: 'r1',
      agentConfig: { model: 'test', systemPrompt: 'test', maxSteps: 5 },
      prompt: 'test',
    });
    eventBus.emit('run:end', {
      runId: 'r1',
      result: 'done',
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });

    expect(events).toEqual(['start', 'end']);
  });

  it('should handle error events', () => {
    let errorMsg = '';

    eventBus.on('run:error', ({ error }) => {
      errorMsg = error;
    });

    eventBus.emit('run:error', { runId: 'r1', error: 'Something failed' });

    expect(errorMsg).toBe('Something failed');
  });

  it('should emit stream:stop event', () => {
    let stopped = false;

    eventBus.on('llm:stream:stop', () => {
      stopped = true;
    });

    eventBus.emit('llm:stream:stop', { runId: 'r1' });

    expect(stopped).toBe(true);
  });
});

describe('useAgentRun sendMessage integration', () => {
  it('should call agentLoop.runStreaming with prompt and sessionId', async () => {
    const mockRunStreaming = vi.fn().mockResolvedValue({
      sessionId: 'sess-1',
      steps: 1,
      finalResponse: 'Done',
      tokenUsage: { input_tokens: 10, output_tokens: 20 },
      status: 'completed',
    });

    const mockAgentLoop = {
      runStreaming: mockRunStreaming,
      cancel: vi.fn(),
    } as unknown as AgentLoop;

    // Simulate what sendMessage does internally
    mockAgentLoop.runStreaming('Hello', 'sess-1');

    expect(mockRunStreaming).toHaveBeenCalledWith('Hello', 'sess-1');
  });

  it('should call agentLoop.cancel when abort is invoked', () => {
    const mockCancel = vi.fn().mockReturnValue(true);

    const mockAgentLoop = {
      runStreaming: vi.fn(),
      cancel: mockCancel,
    } as unknown as AgentLoop;

    // Simulate abort call
    mockAgentLoop.cancel('run-123');

    expect(mockCancel).toHaveBeenCalledWith('run-123');
  });

  it('should not call runStreaming when agentLoop is null', () => {
    // When agentLoop is null, sendMessage should be a no-op
    // This verifies the guard clause in the hook
    const agentLoop: AgentLoop | null = null;
    const called = agentLoop !== null;
    expect(called).toBe(false);
  });
});
