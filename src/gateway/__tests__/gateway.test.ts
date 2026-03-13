// src/gateway/__tests__/gateway.test.ts — Gateway Unit Tests

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Gateway } from '../index.js';

// Mock all heavy dependencies so we can test Gateway in isolation
vi.mock('../../llm/token-storage.js', () => ({
  TokenStorage: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue({ accessToken: 'test', expiresAt: Date.now() + 60000 }),
  })),
}));

vi.mock('../../llm/token-refresh.js', () => ({
  TokenRefresher: vi.fn().mockImplementation(() => ({
    getValidToken: vi.fn().mockResolvedValue('test-token'),
  })),
}));

vi.mock('../../events/event-bus.js', () => ({
  TypedEventBus: vi.fn().mockImplementation(() => ({
    on: vi.fn(() => () => {}),
    emit: vi.fn(),
  })),
}));

vi.mock('../../storage/session-storage.js', () => ({
  SessionStorage: vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    load: vi.fn(),
    create: vi.fn(),
    createSession: vi.fn(),
  })),
}));

vi.mock('../../tools/defaults.js', () => ({
  createDefaultTools: vi.fn().mockReturnValue({
    list: vi.fn().mockReturnValue(['read_file', 'write_file', 'exec']),
    get: vi.fn(),
    has: vi.fn(),
    register: vi.fn(),
    registerAlias: vi.fn(),
  }),
}));

vi.mock('../../runtime/agent-loop.js', () => ({
  AgentLoop: vi.fn().mockImplementation(() => ({
    runStreaming: vi.fn().mockResolvedValue({ result: 'done' }),
    cancel: vi.fn(),
  })),
}));

vi.mock('../../llm/anthropic-client.js', () => ({
  AnthropicClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../agent/config.js', () => ({
  loadAgentConfig: vi.fn().mockResolvedValue({
    model: 'test-model',
    systemPrompt: 'test prompt',
    maxSteps: 10,
    tools: [],
  }),
}));

vi.mock('../../server/ws-bridge.js', () => ({
  createWsBridge: vi.fn().mockReturnValue({
    handleConnection: vi.fn(),
    close: vi.fn(),
    clientCount: vi.fn().mockReturnValue(0),
  }),
}));

vi.mock('../../storage/run-logger.js', () => ({
  RunLogger: vi.fn().mockImplementation(() => ({
    startRun: vi.fn(),
    logToolCall: vi.fn(),
    endRun: vi.fn().mockResolvedValue(undefined),
    loadRun: vi.fn().mockResolvedValue(null),
  })),
}));

vi.mock('../../memory/lancedb-store.js', () => ({
  LanceDBMemoryStore: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue({ id: 'mem-1' }),
    search: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../memory/auto-memory.js', () => ({
  createAutoMemoryHook: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('../../config/user-config.js', () => ({
  loadUserConfig: vi.fn().mockResolvedValue({
    autoSummarize: true,
    summarizerModel: 'test',
    memoryRetentionDays: 90,
    minMessagesForSummary: 3,
  }),
}));

vi.mock('../../multi-agent/agent-registry.js', () => ({
  AgentRegistry: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../multi-agent/message-bus.js', () => ({
  MessageBus: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../../multi-agent/orchestrator.js', () => ({
  AgentOrchestrator: vi.fn().mockImplementation(() => ({})),
}));

// Use dynamic import so mocks are applied before module loads
const { createGateway } = await import('../index.js');

describe('createGateway', () => {
  let gateway: Gateway | undefined;

  // Use a different port per test to avoid EADDRINUSE
  let portCounter = 19000;
  function nextPort(): number {
    return portCounter++;
  }

  afterEach(async () => {
    if (gateway) {
      await gateway.close();
      gateway = undefined;
    }
  });

  it('creates gateway with default options (prod mode)', async () => {
    const port = nextPort();
    gateway = await createGateway({ port });

    expect(gateway).toBeDefined();
    expect(gateway.app).toBeDefined();
    expect(gateway.bridge).toBeDefined();
    expect(gateway.agentLoop).toBeDefined();
    expect(gateway.eventBus).toBeDefined();
    expect(typeof gateway.close).toBe('function');
  });

  it('health endpoint responds with { status: "ok" }', async () => {
    const port = nextPort();
    gateway = await createGateway({ port });

    const response = await gateway.app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ status: 'ok' });
  });

  it('close() shuts down cleanly', async () => {
    const port = nextPort();
    gateway = await createGateway({ port });

    const bridgeCloseSpy = gateway.bridge.close;

    // close should not throw
    await gateway.close();

    // Verify bridge.close was called
    expect(bridgeCloseSpy).toHaveBeenCalled();

    // Prevent double-close in afterEach
    gateway = undefined;
  });

  it('respects custom host and port', async () => {
    const port = nextPort();
    gateway = await createGateway({ host: '127.0.0.1', port });

    // Verify the server is listening by successfully injecting a request
    const response = await gateway.app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(response.statusCode).toBe(200);

    // Verify the addresses match
    const addresses = gateway.app.addresses();
    expect(addresses.length).toBeGreaterThan(0);
    expect(addresses[0].port).toBe(port);
  });
});
