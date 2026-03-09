// src/dashboard/__tests__/ws-auth.test.ts — WebSocket Authentication Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { TypedEventBus } from '../../events/event-bus.js';
import type { EventMap } from '../../types/events.js';
import { attachWebSocket } from '../ws-bridge.js';
import { getDashboardConfig } from '../config.js';

describe('WebSocket Authentication', () => {
  let server: FastifyInstance;
  let eventBus: TypedEventBus<EventMap>;
  let serverAddress: string;

  const TEST_TOKEN = 'test-secret-token-12345';

  async function startServer(wsToken: string | null = null) {
    server = Fastify({ logger: false });
    await server.register(websocket);
    eventBus = new TypedEventBus<EventMap>();

    const config = getDashboardConfig({ wsToken });
    attachWebSocket(server, eventBus, config);

    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get server address');
    }
    serverAddress = `ws://127.0.0.1:${address.port}/ws`;
  }

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  it('should accept connection with valid token', async () => {
    await startServer(TEST_TOKEN);

    const ws = new WebSocket(`${serverAddress}?token=${TEST_TOKEN}`);

    const message = await new Promise<any>((resolve, reject) => {
      ws.on('message', (data: Buffer) => {
        resolve(JSON.parse(data.toString()));
      });
      ws.on('error', reject);
      ws.on('close', (code) => {
        if (code !== 1000) {
          reject(new Error(`Connection closed with code ${code}`));
        }
      });
    });

    expect(message.type).toBe('connected');
    expect(message.clientId).toBeDefined();
    expect(typeof message.clientId).toBe('string');

    ws.close();
  });

  it('should reject connection with invalid token', async () => {
    await startServer(TEST_TOKEN);

    const ws = new WebSocket(`${serverAddress}?token=wrong-token`);

    const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    expect(closeEvent.code).toBe(4401);
    expect(closeEvent.reason).toContain('Unauthorized');
  });

  it('should reject connection with missing token when auth is required', async () => {
    await startServer(TEST_TOKEN);

    const ws = new WebSocket(serverAddress);

    const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    expect(closeEvent.code).toBe(4401);
    expect(closeEvent.reason).toContain('Unauthorized');
  });

  it('should accept connection when no auth is configured (wsToken: null)', async () => {
    await startServer(null);

    const ws = new WebSocket(serverAddress);

    const message = await new Promise<any>((resolve, reject) => {
      ws.on('message', (data: Buffer) => {
        resolve(JSON.parse(data.toString()));
      });
      ws.on('error', reject);
      ws.on('close', (code) => {
        if (code !== 1000) {
          reject(new Error(`Connection closed with code ${code}`));
        }
      });
    });

    expect(message.type).toBe('connected');
    expect(message.clientId).toBeDefined();

    ws.close();
  });

  it('should accept connection with token when no auth is configured (backwards compatible)', async () => {
    await startServer(null);

    // Client sends token even though server doesn't require it
    const ws = new WebSocket(`${serverAddress}?token=any-token`);

    const message = await new Promise<any>((resolve, reject) => {
      ws.on('message', (data: Buffer) => {
        resolve(JSON.parse(data.toString()));
      });
      ws.on('error', reject);
      ws.on('close', (code) => {
        if (code !== 1000) {
          reject(new Error(`Connection closed with code ${code}`));
        }
      });
    });

    expect(message.type).toBe('connected');
    expect(message.clientId).toBeDefined();

    ws.close();
  });

  it('should reject connection with empty token when auth is required', async () => {
    await startServer(TEST_TOKEN);

    const ws = new WebSocket(`${serverAddress}?token=`);

    const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    expect(closeEvent.code).toBe(4401);
    expect(closeEvent.reason).toContain('Unauthorized');
  });

  it('should allow authenticated client to receive events', async () => {
    await startServer(TEST_TOKEN);

    const ws = new WebSocket(`${serverAddress}?token=${TEST_TOKEN}`);

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
      runId: 'test-run-auth',
      agentConfig: { systemPrompt: 'test', model: 'test-model', maxSteps: 10 },
      prompt: 'test prompt',
    });

    const eventMsg = await eventPromise;

    expect(eventMsg.type).toBe('event');
    expect(eventMsg.event).toBe('run:start');
    expect(eventMsg.data.runId).toBe('test-run-auth');

    ws.close();
  });

  it('should reject connection with URL-encoded invalid token', async () => {
    await startServer(TEST_TOKEN);

    const ws = new WebSocket(`${serverAddress}?token=${encodeURIComponent('wrong token with spaces')}`);

    const closeEvent = await new Promise<{ code: number; reason: string }>((resolve) => {
      ws.on('close', (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    expect(closeEvent.code).toBe(4401);
    expect(closeEvent.reason).toContain('Unauthorized');
  });
});
