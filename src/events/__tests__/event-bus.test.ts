// src/events/__tests__/event-bus.test.ts — Event Bus Unit Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TypedEventBus } from '../event-bus.js';
import type { EventMap } from '../../types/events.js';

describe('TypedEventBus', () => {
  let bus: TypedEventBus;

  beforeEach(() => {
    bus = new TypedEventBus();
  });

  it('should emit events and call registered listeners', () => {
    const listener = vi.fn();
    
    bus.on('run:start', listener);
    
    const payload = {
      runId: 'run-123',
      agentConfig: {
        model: 'claude-3',
        systemPrompt: 'Test',
        maxSteps: 10,
      },
      prompt: 'Hello',
    };
    
    bus.emit('run:start', payload);
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('should call once() listeners only once', () => {
    const listener = vi.fn();
    
    bus.once('run:error', listener);
    
    const payload = { runId: 'run-123', error: 'Test error' };
    
    bus.emit('run:error', payload);
    bus.emit('run:error', payload);
    bus.emit('run:error', payload);
    
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it('should remove listeners with off()', () => {
    const listener = vi.fn();
    
    bus.on('tool:call', listener);
    
    const payload = {
      runId: 'run-123',
      toolName: 'calculator',
      input: { a: 1, b: 2 },
      stepIndex: 0,
    };
    
    bus.emit('tool:call', payload);
    expect(listener).toHaveBeenCalledTimes(1);
    
    bus.off('tool:call', listener);
    
    bus.emit('tool:call', payload);
    expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it('should support multiple listeners on the same event', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const listener3 = vi.fn();
    
    bus.on('llm:request', listener1);
    bus.on('llm:request', listener2);
    bus.on('llm:request', listener3);
    
    const payload = {
      runId: 'run-123',
      model: 'claude-3',
      messageCount: 5,
    };
    
    bus.emit('llm:request', payload);
    
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener3).toHaveBeenCalledTimes(1);
    expect(listener1).toHaveBeenCalledWith(payload);
    expect(listener2).toHaveBeenCalledWith(payload);
    expect(listener3).toHaveBeenCalledWith(payload);
  });

  it('should unsubscribe using the returned function from on()', () => {
    const listener = vi.fn();
    
    const unsubscribe = bus.on('run:end', listener);
    
    const payload = {
      runId: 'run-123',
      result: 'Success',
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    };
    
    bus.emit('run:end', payload);
    expect(listener).toHaveBeenCalledTimes(1);
    
    unsubscribe();
    
    bus.emit('run:end', payload);
    expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
  });

  it('should not cause cross-event interference', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    bus.on('run:start', listener1);
    bus.on('run:end', listener2);
    
    const payload1 = {
      runId: 'run-123',
      agentConfig: {
        model: 'claude-3',
        systemPrompt: 'Test',
        maxSteps: 10,
      },
      prompt: 'Hello',
    };
    
    const payload2 = {
      runId: 'run-123',
      result: 'Done',
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    };
    
    bus.emit('run:start', payload1);
    
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(0);
    
    bus.emit('run:end', payload2);
    
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    expect(listener1).toHaveBeenCalledWith(payload1);
    expect(listener2).toHaveBeenCalledWith(payload2);
  });

  it('should clear all listeners for a specific event', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    bus.on('run:step', listener1);
    bus.on('run:step', listener2);
    
    expect(bus.listenerCount('run:step')).toBe(2);
    
    bus.clear('run:step');
    
    expect(bus.listenerCount('run:step')).toBe(0);
    
    const payload = {
      runId: 'run-123',
      stepIndex: 0,
      message: {
        role: 'user' as const,
        content: 'Test',
        timestamp: new Date().toISOString(),
      },
    };
    
    bus.emit('run:step', payload);
    
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it('should clear all listeners when clear() called without arguments', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    bus.on('run:start', listener1);
    bus.on('run:end', listener2);
    
    expect(bus.listenerCount('run:start')).toBe(1);
    expect(bus.listenerCount('run:end')).toBe(1);
    
    bus.clear();
    
    expect(bus.listenerCount('run:start')).toBe(0);
    expect(bus.listenerCount('run:end')).toBe(0);
  });

  it('should return 0 for listenerCount on non-existent events', () => {
    expect(bus.listenerCount('run:start')).toBe(0);
  });
});
