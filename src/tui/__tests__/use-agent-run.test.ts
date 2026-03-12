// src/tui/__tests__/use-agent-run.test.ts — useAgentRun hook tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypedEventBus } from '../../events/event-bus.js';

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
