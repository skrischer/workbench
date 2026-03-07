// src/dashboard/__tests__/ws-bridge.test.ts — Tests for WebSocket Bridge

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { TypedEventBus } from '../../events/event-bus.js';
import type { EventMap } from '../../types/events.js';
import { attachWebSocket } from '../ws-bridge.js';

describe('WebSocket Bridge', () => {
  let server: FastifyInstance;
  let eventBus: TypedEventBus<EventMap>;
  let serverAddress: string;

  beforeEach(async () => {
    // Create fresh server and event bus for each test
    server = Fastify({ logger: false });
    await server.register(websocket);
    eventBus = new TypedEventBus<EventMap>();

    // Attach WebSocket bridge
    attachWebSocket(server, eventBus);

    // Start server on random port
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    serverAddress = `ws://127.0.0.1:${address.port}/ws`;
  });

  afterEach(async () => {
    await server.close();
  });

  it('should connect and receive connected message with default subscription', async () => {
    const ws = new WebSocket(serverAddress);

    const message = await new Promise<any>((resolve) => {
      ws.on('message', (data: Buffer) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    expect(message.type).toBe('connected');
    expect(message.clientId).toBeDefined();
    expect(typeof message.clientId).toBe('string');
    expect(message.subscribedEvents).toEqual(['*']);

    ws.close();
  });

  it('should broadcast events to subscribed clients', async () => {
    const ws = new WebSocket(serverAddress);

    // Wait for connection
    await new Promise<void>((resolve) => {
      ws.on('message', (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connected') {
          resolve();
        }
      });
    });

    // Listen for event
    const eventPromise = new Promise<any>((resolve) => {
      ws.on('message', (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'event') {
          resolve(msg);
        }
      });
    });

    // Emit event via event bus
    eventBus.emit('run:start', {
      runId: 'test-run-123',
      agentConfig: { systemPrompt: 'test', model: 'test-model', maxSteps: 10 },
      prompt: 'test prompt',
    });

    const eventMsg = await eventPromise;

    expect(eventMsg.type).toBe('event');
    expect(eventMsg.event).toBe('run:start');
    expect(eventMsg.data).toEqual({
      runId: 'test-run-123',
      agentConfig: { systemPrompt: 'test', model: 'test-model', maxSteps: 10 },
      prompt: 'test prompt',
    });
    expect(eventMsg.timestamp).toBeDefined();

    ws.close();
  });

  it('should filter events based on subscribe patterns', async () => {
    const ws = new WebSocket(serverAddress);

    // Wait for connection
    await new Promise<void>((resolve) => {
      ws.on('message', (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connected') {
          resolve();
        }
      });
    });

    // Subscribe only to run:* events
    ws.send(JSON.stringify({
      type: 'subscribe',
      events: ['run:*'],
    }));

    // Unsubscribe from default *
    ws.send(JSON.stringify({
      type: 'unsubscribe',
      events: ['*'],
    }));

    // Give it a moment to process
    await new Promise((resolve) => setTimeout(resolve, 50));

    const receivedEvents: string[] = [];

    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'event') {
        receivedEvents.push(msg.event);
      }
    });

    // Emit various events
    eventBus.emit('run:start', {
      runId: 'test-1',
      agentConfig: { systemPrompt: 'test', model: 'test', maxSteps: 10 },
      prompt: 'test',
    });

    eventBus.emit('tool:call', {
      runId: 'test-1',
      toolName: 'test-tool',
      input: {},
      stepIndex: 0,
    });

    eventBus.emit('run:end', {
      runId: 'test-1',
      result: 'done',
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });

    // Wait for events to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should only receive run:* events
    expect(receivedEvents).toContain('run:start');
    expect(receivedEvents).toContain('run:end');
    expect(receivedEvents).not.toContain('tool:call');

    ws.close();
  });

  it('should support glob pattern matching', async () => {
    const ws = new WebSocket(serverAddress);

    // Wait for connection
    await new Promise<void>((resolve) => {
      ws.on('message', (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connected') {
          resolve();
        }
      });
    });

    // Subscribe to plan:step:* and tool:*
    ws.send(JSON.stringify({
      type: 'subscribe',
      events: ['plan:step:*', 'tool:*'],
    }));

    // Unsubscribe from default *
    ws.send(JSON.stringify({
      type: 'unsubscribe',
      events: ['*'],
    }));

    await new Promise((resolve) => setTimeout(resolve, 50));

    const receivedEvents: string[] = [];

    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'event') {
        receivedEvents.push(msg.event);
      }
    });

    // Emit various events
    eventBus.emit('plan:step:start', {
      planId: 'plan-1',
      stepId: 'step-1',
      stepIndex: 0,
      stepTitle: 'Test Step',
    });

    eventBus.emit('plan:start', {
      planId: 'plan-1',
      title: 'Test Plan',
      stepCount: 1,
    });

    eventBus.emit('tool:result', {
      runId: 'run-1',
      toolName: 'test-tool',
      result: { success: true, output: 'test' },
      durationMs: 100,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(receivedEvents).toContain('plan:step:start');
    expect(receivedEvents).toContain('tool:result');
    expect(receivedEvents).not.toContain('plan:start'); // Doesn't match plan:step:*

    ws.close();
  });

  it('should support exact event name matching', async () => {
    const ws = new WebSocket(serverAddress);

    // Wait for connection
    await new Promise<void>((resolve) => {
      ws.on('message', (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connected') {
          resolve();
        }
      });
    });

    // Subscribe to exact event name
    ws.send(JSON.stringify({
      type: 'subscribe',
      events: ['run:end'],
    }));

    ws.send(JSON.stringify({
      type: 'unsubscribe',
      events: ['*'],
    }));

    await new Promise((resolve) => setTimeout(resolve, 50));

    const receivedEvents: string[] = [];

    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'event') {
        receivedEvents.push(msg.event);
      }
    });

    eventBus.emit('run:start', {
      runId: 'test-1',
      agentConfig: { systemPrompt: 'test', model: 'test', maxSteps: 10 },
      prompt: 'test',
    });

    eventBus.emit('run:end', {
      runId: 'test-1',
      result: 'done',
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(receivedEvents).toContain('run:end');
    expect(receivedEvents).not.toContain('run:start');

    ws.close();
  });

  it('should clean up on disconnect', async () => {
    const ws = new WebSocket(serverAddress);

    // Wait for connection
    await new Promise<void>((resolve) => {
      ws.on('message', (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connected') {
          resolve();
        }
      });
    });

    // Close the connection
    ws.close();

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Try to emit an event (should not crash)
    expect(() => {
      eventBus.emit('run:start', {
        runId: 'test-after-disconnect',
        agentConfig: { systemPrompt: 'test', model: 'test', maxSteps: 10 },
        prompt: 'test',
      });
    }).not.toThrow();
  });

  it('should send heartbeat pings every 30 seconds', async () => {
    vi.useFakeTimers();

    const ws = new WebSocket(serverAddress);

    // Wait for connection
    await new Promise<void>((resolve) => {
      ws.on('message', (data: Buffer) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'connected') {
          resolve();
        }
      });
    });

    const pings: any[] = [];

    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ping') {
        pings.push(msg);
      }
    });

    // Fast-forward 30 seconds
    await vi.advanceTimersByTimeAsync(30_000);

    // Should have received at least one ping
    expect(pings.length).toBeGreaterThanOrEqual(1);

    ws.close();
    vi.useRealTimers();
  }, 10_000); // Increase timeout for this test
});
