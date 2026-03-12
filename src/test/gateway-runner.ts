// src/test/gateway-runner.ts — E2E Test Helper for Gateway + WebSocket
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { MockResponse } from './mock-anthropic-server.js';
import { createMockAnthropicServer } from './mock-anthropic-server.js';
import type { MockAnthropicServer } from './mock-anthropic-server.js';
import { createTestEnv } from './test-env.js';
import type { TestEnv } from './test-env.js';
import { createGateway } from '../gateway/index.js';
import type { Gateway } from '../gateway/index.js';
import type {
  WsCommandMessage,
  WsCommand,
  WsResponseMessage,
  WsEventMessage,
  ServerMessage,
} from '../types/ws-protocol.js';

export interface GatewayTestRunner {
  /** The Gateway instance (Fastify + WsBridge) */
  gateway: Gateway;
  /** Connected WebSocket client */
  ws: WebSocket;
  /** Mock Anthropic server */
  mockServer: MockAnthropicServer;
  /** Test environment (temp dirs, env vars) */
  testEnv: TestEnv;
  /** Send a command and wait for its response */
  sendCommand(command: WsCommand, payload?: Record<string, unknown>): Promise<unknown>;
  /** Wait for a specific event type to arrive */
  waitForEvent(eventType: string, timeout?: number): Promise<WsEventMessage>;
  /** Register a collector for all events of a given type */
  collectEvents(eventType: string): WsEventMessage[];
  /** Gracefully shut down everything */
  close(): Promise<void>;
}

export interface GatewayTestOptions {
  /** Mock responses for the Anthropic API */
  fixtures?: MockResponse[];
  /** Custom agent config to write to agent.json */
  agentConfig?: Record<string, unknown>;
}

/**
 * Create a fully wired Gateway test environment:
 * 1. Start mock Anthropic server
 * 2. Create isolated test env (temp dirs, tokens, agent config)
 * 3. Start Gateway on a random port (port 0)
 * 4. Connect a WebSocket client
 *
 * Returns a GatewayTestRunner with helpers for sending commands,
 * waiting for events, and collecting event streams.
 */
export async function createTestGateway(
  options: GatewayTestOptions = {},
): Promise<GatewayTestRunner> {
  const { fixtures = [], agentConfig } = options;

  // 1. Start mock Anthropic server
  const mockServer = await createMockAnthropicServer(fixtures);

  // 2. Create isolated test environment
  const testEnv = await createTestEnv({
    anthropicApiUrl: `${mockServer.url}/v1/messages`,
    agentConfig,
  });

  // 3. Inject env vars into process.env for Gateway consumption
  const originalEnv: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(testEnv.env)) {
    originalEnv[key] = process.env[key];
    process.env[key] = value;
  }

  // 4. Start Gateway on random port (port 0 lets OS choose)
  let gateway: Gateway;
  try {
    gateway = await createGateway({ port: 0, host: '127.0.0.1' });
  } catch (err) {
    // Restore env and clean up on failure
    restoreEnv(originalEnv);
    await mockServer.close();
    await testEnv.cleanup();
    throw err;
  }

  // 5. Determine assigned port
  const address = gateway.app.server.address();
  if (!address || typeof address === 'string') {
    restoreEnv(originalEnv);
    await gateway.close();
    await mockServer.close();
    await testEnv.cleanup();
    throw new Error('Gateway did not bind to a port');
  }
  const gatewayPort = address.port;

  // 6. Connect WebSocket client
  const ws = await connectWebSocket(`ws://127.0.0.1:${gatewayPort}/ws`);

  // Restore process.env now that Gateway has started
  restoreEnv(originalEnv);

  // --- Internal state ---
  // Pending response promises keyed by requestId
  const pendingResponses = new Map<string, {
    resolve: (data: unknown) => void;
    reject: (err: Error) => void;
  }>();

  // Event waiters: one-shot promises for specific event types
  const eventWaiters: Array<{
    eventType: string;
    resolve: (msg: WsEventMessage) => void;
    reject: (err: Error) => void;
  }> = [];

  // Event collectors: arrays that accumulate events by type
  const eventCollectors = new Map<string, WsEventMessage[]>();

  // --- WebSocket message router ---
  ws.on('message', (raw: WebSocket.RawData) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw.toString()) as ServerMessage;
    } catch {
      return; // Ignore malformed messages
    }

    if (msg.type === 'response') {
      const resp = msg as WsResponseMessage;
      const pending = pendingResponses.get(resp.requestId);
      if (pending) {
        pendingResponses.delete(resp.requestId);
        if (resp.error) {
          pending.reject(new Error(`${resp.error.code}: ${resp.error.message}`));
        } else {
          pending.resolve(resp.data);
        }
      }
    } else if (msg.type === 'event') {
      const evt = msg as WsEventMessage;

      // Resolve any waiters for this event type (FIFO)
      const waiterIdx = eventWaiters.findIndex((w) => w.eventType === evt.event);
      if (waiterIdx >= 0) {
        const waiter = eventWaiters[waiterIdx]!;
        eventWaiters.splice(waiterIdx, 1);
        waiter.resolve(evt);
      }

      // Append to collectors
      const collector = eventCollectors.get(evt.event);
      if (collector) {
        collector.push(evt);
      }
    }
  });

  // --- Public API ---

  function sendCommand(
    command: WsCommand,
    payload?: Record<string, unknown>,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const msg: WsCommandMessage = {
      type: 'command',
      command,
      requestId,
      payload,
    };

    return new Promise<unknown>((resolve, reject) => {
      pendingResponses.set(requestId, { resolve, reject });

      if (ws.readyState !== WebSocket.OPEN) {
        pendingResponses.delete(requestId);
        reject(new Error('WebSocket is not open'));
        return;
      }

      ws.send(JSON.stringify(msg), (err) => {
        if (err) {
          pendingResponses.delete(requestId);
          reject(err);
        }
      });

      // Timeout after 10s
      setTimeout(() => {
        if (pendingResponses.has(requestId)) {
          pendingResponses.delete(requestId);
          reject(new Error(`Command '${command}' timed out after 10s`));
        }
      }, 10_000);
    });
  }

  function waitForEvent(eventType: string, timeout = 10_000): Promise<WsEventMessage> {
    return new Promise<WsEventMessage>((resolve, reject) => {
      const waiter = { eventType, resolve, reject };
      eventWaiters.push(waiter);

      setTimeout(() => {
        const idx = eventWaiters.indexOf(waiter);
        if (idx >= 0) {
          eventWaiters.splice(idx, 1);
          reject(new Error(`Timed out waiting for event '${eventType}' after ${timeout}ms`));
        }
      }, timeout);
    });
  }

  function collectEvents(eventType: string): WsEventMessage[] {
    let arr = eventCollectors.get(eventType);
    if (!arr) {
      arr = [];
      eventCollectors.set(eventType, arr);
    }
    return arr;
  }

  async function close(): Promise<void> {
    // Reject all pending responses
    for (const [id, pending] of pendingResponses) {
      pending.reject(new Error('Gateway test runner closed'));
      pendingResponses.delete(id);
    }

    // Reject all pending waiters
    for (const waiter of eventWaiters) {
      waiter.reject(new Error('Gateway test runner closed'));
    }
    eventWaiters.length = 0;

    // Close WebSocket
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
      await new Promise<void>((resolve) => {
        ws.once('close', () => resolve());
        setTimeout(resolve, 1_000); // Safety timeout
      });
    }

    // Close Gateway (Fastify + bridge)
    await gateway.close();

    // Close mock Anthropic server
    await mockServer.close();

    // Clean up temp directory
    await testEnv.cleanup();
  }

  return {
    gateway,
    ws,
    mockServer,
    testEnv,
    sendCommand,
    waitForEvent,
    collectEvents,
    close,
  };
}

// --- Internal helpers ---

function restoreEnv(original: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function connectWebSocket(url: string, timeout = 5_000): Promise<WebSocket> {
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(url);

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket connection to ${url} timed out after ${timeout}ms`));
    }, timeout);

    ws.once('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });

    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
