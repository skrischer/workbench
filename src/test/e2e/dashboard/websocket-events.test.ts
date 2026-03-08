// src/test/e2e/dashboard/websocket-events.test.ts — WebSocket Event Bridge E2E Tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { createDashboard, type DashboardInstance } from '../../../dashboard/create-dashboard.js';
import { createTestEnv, type TestEnv } from '../../test-env.js';

describe('WebSocket Event Bridge', () => {
  let testEnv: TestEnv;
  let dashboard: DashboardInstance;
  let serverPort: number;
  let wsUrl: string;

  beforeAll(async () => {
    // Create test environment with WORKBENCH_HOME
    testEnv = await createTestEnv();
    
    // Set WORKBENCH_HOME for storage instances
    process.env.WORKBENCH_HOME = testEnv.workbenchHome;
    
    // Create dashboard with server and routes
    dashboard = await createDashboard({ port: 0, host: 'localhost' });
    
    // Start server and get assigned port
    await dashboard.server.listen({ port: 0, host: 'localhost' });
    
    const address = dashboard.server.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server port');
    }
    serverPort = address.port;
    wsUrl = `ws://localhost:${serverPort}/ws`;
  });

  afterAll(async () => {
    // Close server
    await dashboard.server.close();
    
    // Clean up test environment
    await testEnv.cleanup();
  });

  /**
   * Helper: Connect to WebSocket
   * Note: Attach message handlers BEFORE waiting for 'open' to avoid race conditions
   */
  function connectWebSocket(): WebSocket {
    return new WebSocket(wsUrl);
  }

  /**
   * Helper: Wait for WebSocket to be open
   */
  function waitForOpen(ws: WebSocket, timeoutMs = 5000): Promise<void> {
    if (ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.off('open', onOpen);
        ws.off('error', onError);
        reject(new Error(`Timeout waiting for WebSocket to open (${timeoutMs}ms)`));
      }, timeoutMs);

      const onOpen = () => {
        clearTimeout(timeout);
        ws.off('error', onError);
        resolve();
      };

      const onError = (error: Error) => {
        clearTimeout(timeout);
        ws.off('open', onOpen);
        reject(error);
      };

      ws.on('open', onOpen);
      ws.on('error', onError);
    });
  }

  /**
   * Helper: Wait for next WebSocket message with timeout
   */
  function waitForMessage(ws: WebSocket, timeoutMs = 5000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.off('message', onMessage);
        reject(new Error(`Timeout waiting for WebSocket message (${timeoutMs}ms)`));
      }, timeoutMs);

      const onMessage = (data: WebSocket.Data) => {
        clearTimeout(timeout);
        ws.off('message', onMessage);
        try {
          const parsed = JSON.parse(data.toString());
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      };

      ws.on('message', onMessage);
    });
  }

  /**
   * Helper: Send JSON message over WebSocket
   */
  function sendMessage(ws: WebSocket, message: unknown): void {
    ws.send(JSON.stringify(message));
  }

  describe('Connection', () => {
    it('connects to /ws and receives connected message with clientId', async () => {
      const ws = connectWebSocket();
      
      try {
        // Attach message handler BEFORE connection opens
        const messagePromise = waitForMessage(ws);
        await waitForOpen(ws);
        
        const message = await messagePromise;
        
        expect(message).toMatchObject({
          type: 'connected',
          subscribedEvents: ['*'],
        });
        
        // Should have a clientId
        expect(message).toHaveProperty('clientId');
        expect(typeof (message as any).clientId).toBe('string');
        expect((message as any).clientId.length).toBeGreaterThan(0);
      } finally {
        ws.close();
      }
    });
  });

  describe('Event Broadcast', () => {
    it('broadcasts eventBus events to WebSocket clients', async () => {
      const ws = connectWebSocket();
      
      try {
        // Wait for connected message first
        const connectedPromise = waitForMessage(ws);
        await waitForOpen(ws);
        await connectedPromise;
        
        // Set up listener for event
        const eventPromise = waitForMessage(ws);
        
        // Emit run:start event on eventBus
        const runStartPayload = {
          runId: 'test-run-123',
          agentConfig: { model: 'claude-test', systemPrompt: 'You are a test agent', maxSteps: 10 },
          prompt: 'Test prompt',
        };
        
        dashboard.eventBus.emit('run:start', runStartPayload);
        
        // Wait for event message
        const eventMessage = await eventPromise;
        
        expect(eventMessage).toMatchObject({
          type: 'event',
          event: 'run:start',
          data: runStartPayload,
        });
        
        // Should have timestamp
        expect(eventMessage).toHaveProperty('timestamp');
        expect(typeof (eventMessage as any).timestamp).toBe('string');
      } finally {
        ws.close();
      }
    });

    it('broadcasts multiple different events', async () => {
      const ws = connectWebSocket();
      
      try {
        // Wait for connected message
        const connectedPromise = waitForMessage(ws);
        await waitForOpen(ws);
        await connectedPromise;
        
        // Emit tool:call event
        const event1Promise = waitForMessage(ws);
        const toolCallPayload = {
          runId: 'test-run-456',
          toolName: 'read_file',
          input: { path: '/test/file.txt' },
          stepIndex: 0,
        };
        
        dashboard.eventBus.emit('tool:call', toolCallPayload);
        
        const message1 = await event1Promise;
        expect(message1).toMatchObject({
          type: 'event',
          event: 'tool:call',
          data: toolCallPayload,
        });
        
        // Emit run:end event
        const event2Promise = waitForMessage(ws);
        const runEndPayload = {
          runId: 'test-run-456',
          result: 'Task completed successfully',
          tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        };
        
        dashboard.eventBus.emit('run:end', runEndPayload);
        
        const message2 = await event2Promise;
        expect(message2).toMatchObject({
          type: 'event',
          event: 'run:end',
          data: runEndPayload,
        });
      } finally {
        ws.close();
      }
    });
  });

  describe('Subscribe/Unsubscribe', () => {
    it('allows client to filter events by subscription', async () => {
      const ws = connectWebSocket();
      
      try {
        // Wait for connected message
        const connectedPromise = waitForMessage(ws);
        await waitForOpen(ws);
        await connectedPromise;
        
        // Unsubscribe from all events
        sendMessage(ws, { type: 'unsubscribe', events: ['*'] });
        
        // Subscribe only to run:* events
        sendMessage(ws, { type: 'subscribe', events: ['run:*'] });
        
        // Wait a bit for subscription to take effect
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Emit run:start (should be received)
        const event1Promise = waitForMessage(ws, 2000);
        const runStartPayload = {
          runId: 'test-run-789',
          agentConfig: { model: 'claude-test', systemPrompt: 'You are a test agent', maxSteps: 5 },
          prompt: 'Filtered test',
        };
        
        dashboard.eventBus.emit('run:start', runStartPayload);
        
        const message1 = await event1Promise;
        expect(message1).toMatchObject({
          type: 'event',
          event: 'run:start',
          data: runStartPayload,
        });
        
        // Emit tool:call (should NOT be received)
        const toolCallPayload = {
          runId: 'test-run-789',
          toolName: 'write_file',
          input: { path: '/test/output.txt', content: 'test' },
          stepIndex: 0,
        };
        
        dashboard.eventBus.emit('tool:call', toolCallPayload);
        
        // Wait and ensure no message arrives (should timeout)
        await expect(waitForMessage(ws, 500)).rejects.toThrow('Timeout');
      } finally {
        ws.close();
      }
    });

    it('supports exact event name subscription', async () => {
      const ws = connectWebSocket();
      
      try {
        // Wait for connected message
        const connectedPromise = waitForMessage(ws);
        await waitForOpen(ws);
        await connectedPromise;
        
        // Unsubscribe from all
        sendMessage(ws, { type: 'unsubscribe', events: ['*'] });
        
        // Subscribe to exact event name
        sendMessage(ws, { type: 'subscribe', events: ['run:start'] });
        
        // Wait for subscription
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Emit run:start (should be received)
        const event1Promise = waitForMessage(ws, 2000);
        dashboard.eventBus.emit('run:start', {
          runId: 'exact-test',
          agentConfig: { model: 'test', systemPrompt: 'You are a test agent', maxSteps: 1 },
          prompt: 'exact',
        });
        
        const message1 = await event1Promise;
        expect(message1).toMatchObject({
          type: 'event',
          event: 'run:start',
        });
        
        // Emit run:end (should NOT be received - exact match only)
        dashboard.eventBus.emit('run:end', {
          runId: 'exact-test',
          result: 'done',
          tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        });
        
        // Should timeout
        await expect(waitForMessage(ws, 500)).rejects.toThrow('Timeout');
      } finally {
        ws.close();
      }
    });
  });

  describe('Multiple Clients', () => {
    it('broadcasts events to all connected WebSocket clients', async () => {
      const ws1 = connectWebSocket();
      const ws2 = connectWebSocket();
      
      try {
        // Wait for both connected messages
        const conn1Promise = waitForMessage(ws1);
        const conn2Promise = waitForMessage(ws2);
        await waitForOpen(ws1);
        await waitForOpen(ws2);
        await conn1Promise;
        await conn2Promise;
        
        // Set up event listeners
        const event1Promise = waitForMessage(ws1, 2000);
        const event2Promise = waitForMessage(ws2, 2000);
        
        // Emit event
        const payload = {
          runId: 'multi-client-test',
          agentConfig: { model: 'test-model', systemPrompt: 'You are a test agent', maxSteps: 3 },
          prompt: 'Broadcasting to all',
        };
        
        dashboard.eventBus.emit('run:start', payload);
        
        // Both clients should receive the event
        const [message1, message2] = await Promise.all([event1Promise, event2Promise]);
        
        expect(message1).toMatchObject({
          type: 'event',
          event: 'run:start',
          data: payload,
        });
        
        expect(message2).toMatchObject({
          type: 'event',
          event: 'run:start',
          data: payload,
        });
      } finally {
        ws1.close();
        ws2.close();
      }
    });

    it('handles independent subscriptions for different clients', async () => {
      const ws1 = connectWebSocket();
      const ws2 = connectWebSocket();
      
      try {
        // Wait for connected messages
        const conn1Promise = waitForMessage(ws1);
        const conn2Promise = waitForMessage(ws2);
        await waitForOpen(ws1);
        await waitForOpen(ws2);
        await conn1Promise;
        await conn2Promise;
        
        // ws1: subscribe to run:* only
        sendMessage(ws1, { type: 'unsubscribe', events: ['*'] });
        sendMessage(ws1, { type: 'subscribe', events: ['run:*'] });
        
        // ws2: subscribe to tool:* only
        sendMessage(ws2, { type: 'unsubscribe', events: ['*'] });
        sendMessage(ws2, { type: 'subscribe', events: ['tool:*'] });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Emit run:start (only ws1 should receive)
        const ws1EventPromise = waitForMessage(ws1, 2000);
        dashboard.eventBus.emit('run:start', {
          runId: 'independent-test',
          agentConfig: { model: 'test', systemPrompt: 'You are a test agent', maxSteps: 1 },
          prompt: 'test',
        });
        
        const ws1Message = await ws1EventPromise;
        expect(ws1Message).toMatchObject({
          type: 'event',
          event: 'run:start',
        });
        
        // ws2 should NOT receive it
        await expect(waitForMessage(ws2, 500)).rejects.toThrow('Timeout');
        
        // Emit tool:call (only ws2 should receive)
        const ws2EventPromise = waitForMessage(ws2, 2000);
        dashboard.eventBus.emit('tool:call', {
          runId: 'independent-test',
          toolName: 'test_tool',
          input: { test: true },
          stepIndex: 0,
        });
        
        const ws2Message = await ws2EventPromise;
        expect(ws2Message).toMatchObject({
          type: 'event',
          event: 'tool:call',
        });
        
        // ws1 should NOT receive it
        await expect(waitForMessage(ws1, 500)).rejects.toThrow('Timeout');
      } finally {
        ws1.close();
        ws2.close();
      }
    });
  });
});
