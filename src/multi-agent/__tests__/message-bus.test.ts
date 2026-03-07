// src/multi-agent/__tests__/message-bus.test.ts — MessageBus Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageBus } from '../message-bus.js';
import { eventBus } from '../../events/event-bus.js';
import type { AgentMessage } from '../../types/agent.js';

describe('MessageBus', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
    eventBus.clear(); // Clear event bus between tests
  });

  it('should send message to agent with registered handler', () => {
    const received: AgentMessage[] = [];
    const handler = (msg: AgentMessage) => received.push(msg);

    bus.onMessage('agent-b', handler);
    const sent = bus.send('agent-a', 'agent-b', 'task', { action: 'test' });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(sent);
    expect(sent.from).toBe('agent-a');
    expect(sent.to).toBe('agent-b');
    expect(sent.type).toBe('task');
    expect(sent.payload).toEqual({ action: 'test' });
    expect(sent.timestamp).toBeDefined();
  });

  it('should broadcast message to all registered agents except sender', () => {
    const receivedA: AgentMessage[] = [];
    const receivedB: AgentMessage[] = [];
    const receivedC: AgentMessage[] = [];

    bus.onMessage('agent-a', (msg) => receivedA.push(msg));
    bus.onMessage('agent-b', (msg) => receivedB.push(msg));
    bus.onMessage('agent-c', (msg) => receivedC.push(msg));

    const messages = bus.broadcast('agent-a', 'status', { status: 'ready' });

    // Should send to agent-b and agent-c, but NOT agent-a
    expect(messages).toHaveLength(2);
    expect(receivedA).toHaveLength(0); // Sender should not receive
    expect(receivedB).toHaveLength(1);
    expect(receivedC).toHaveLength(1);

    expect(receivedB[0].from).toBe('agent-a');
    expect(receivedB[0].payload).toEqual({ status: 'ready' });
  });

  it('should queue messages when no handler is registered', () => {
    const sent1 = bus.send('agent-a', 'agent-b', 'task', { task: 1 });
    const sent2 = bus.send('agent-a', 'agent-b', 'task', { task: 2 });

    const queue = bus.getQueue('agent-b');
    expect(queue).toHaveLength(2);
    expect(queue[0]).toEqual(sent1);
    expect(queue[1]).toEqual(sent2);
  });

  it('should deliver queued messages when handler is registered', () => {
    // Send messages before handler is registered
    bus.send('agent-a', 'agent-b', 'task', { task: 1 });
    bus.send('agent-a', 'agent-b', 'task', { task: 2 });

    const received: AgentMessage[] = [];
    bus.onMessage('agent-b', (msg) => received.push(msg));

    // Should receive both queued messages immediately
    expect(received).toHaveLength(2);
    expect(received[0].payload).toEqual({ task: 1 });
    expect(received[1].payload).toEqual({ task: 2 });

    // Queue should be cleared
    expect(bus.getQueue('agent-b')).toHaveLength(0);
  });

  it('should track message history', () => {
    bus.send('agent-a', 'agent-b', 'task', { task: 1 });
    bus.send('agent-b', 'agent-c', 'result', { result: 'done' });
    bus.send('agent-c', 'agent-a', 'status', { status: 'ok' });

    const history = bus.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].from).toBe('agent-a');
    expect(history[1].from).toBe('agent-b');
    expect(history[2].from).toBe('agent-c');
  });

  it('should filter history by agent ID', () => {
    bus.send('agent-a', 'agent-b', 'task', { task: 1 });
    bus.send('agent-b', 'agent-c', 'result', { result: 'done' });
    bus.send('agent-c', 'agent-a', 'status', { status: 'ok' });

    const historyA = bus.getHistory('agent-a');
    expect(historyA).toHaveLength(2); // agent-a sent one, received one
    expect(historyA[0].from).toBe('agent-a');
    expect(historyA[1].to).toBe('agent-a');

    const historyB = bus.getHistory('agent-b');
    expect(historyB).toHaveLength(2); // agent-b received one, sent one
  });

  it('should unsubscribe handler correctly', () => {
    const received: AgentMessage[] = [];
    const handler = (msg: AgentMessage) => received.push(msg);

    const unsubscribe = bus.onMessage('agent-b', handler);

    bus.send('agent-a', 'agent-b', 'task', { task: 1 });
    expect(received).toHaveLength(1);

    // Unsubscribe and send another message
    unsubscribe();
    bus.send('agent-a', 'agent-b', 'task', { task: 2 });

    // Should not receive the second message
    expect(received).toHaveLength(1);

    // Second message should be queued
    expect(bus.getQueue('agent-b')).toHaveLength(1);
  });

  it('should emit message:sent event', () => {
    const events: any[] = [];
    eventBus.on('message:sent', (payload) => events.push(payload));

    bus.send('agent-a', 'agent-b', 'task', { action: 'test' });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      from: 'agent-a',
      to: 'agent-b',
      type: 'task',
      payload: { action: 'test' },
    });
  });

  it('should emit message:received event when handler is registered', () => {
    const events: any[] = [];
    eventBus.on('message:received', (payload) => events.push(payload));

    bus.onMessage('agent-b', () => {});
    bus.send('agent-a', 'agent-b', 'task', { action: 'test' });

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      agentId: 'agent-b',
      from: 'agent-a',
      to: 'agent-b',
      type: 'task',
      payload: { action: 'test' },
    });
  });

  it('should not emit message:received when no handler (queued)', () => {
    const events: any[] = [];
    eventBus.on('message:received', (payload) => events.push(payload));

    bus.send('agent-a', 'agent-b', 'task', { action: 'test' });

    // Should not emit received event yet (message is queued)
    expect(events).toHaveLength(0);
  });

  it('should support multiple handlers for same agent', () => {
    const received1: AgentMessage[] = [];
    const received2: AgentMessage[] = [];

    bus.onMessage('agent-b', (msg) => received1.push(msg));
    bus.onMessage('agent-b', (msg) => received2.push(msg));

    bus.send('agent-a', 'agent-b', 'task', { action: 'test' });

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
    expect(received1[0]).toEqual(received2[0]);
  });

  it('should validate messages before sending', () => {
    // Empty 'from' should throw
    expect(() => {
      bus.send('', 'agent-b', 'task', {});
    }).toThrow('AgentMessage must have a non-empty from field');

    // Invalid type should throw
    expect(() => {
      bus.send('agent-a', 'agent-b', 'invalid' as any, {});
    }).toThrow('AgentMessage type must be one of');
  });
});
