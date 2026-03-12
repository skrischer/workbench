// src/runtime/__tests__/agent-loop-streaming.test.ts — runStreaming tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentLoop } from '../agent-loop.js';
import { TypedEventBus } from '../../events/event-bus.js';
import type { AnthropicClient } from '../../llm/anthropic-client.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { ToolRegistry } from '../../tools/registry.js';
import type { AgentConfig, Session } from '../../types/index.js';
import type { StreamDelta } from '../../llm/streaming.js';

function createMockSession(id = 'session-1'): Session {
  return {
    id,
    agentId: 'test',
    messages: [],
    toolCalls: [],
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createAsyncIterable(deltas: StreamDelta[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const delta of deltas) {
        yield delta;
      }
    },
    abort: vi.fn(),
  };
}

describe('AgentLoop.runStreaming', () => {
  let agentLoop: AgentLoop;
  let mockClient: AnthropicClient;
  let mockStorage: SessionStorage;
  let mockToolRegistry: ToolRegistry;
  let eventBus: TypedEventBus;
  let config: AgentConfig;

  beforeEach(() => {
    const session = createMockSession();

    mockStorage = {
      create: vi.fn().mockResolvedValue(session),
      load: vi.fn().mockResolvedValue(session),
      save: vi.fn().mockResolvedValue(undefined),
      addMessage: vi.fn().mockImplementation(async (id: string, msg: unknown) => {
        session.messages.push(msg as Session['messages'][0]);
      }),
    } as unknown as SessionStorage;

    mockClient = {
      sendMessage: vi.fn(),
      sendMessageStream: vi.fn(),
    } as unknown as AnthropicClient;

    mockToolRegistry = {
      list: vi.fn().mockReturnValue([]),
      get: vi.fn(),
      has: vi.fn(),
    } as unknown as ToolRegistry;

    eventBus = new TypedEventBus();

    config = {
      model: 'test-model',
      systemPrompt: 'You are a test agent.',
      maxSteps: 5,
    };

    agentLoop = new AgentLoop(mockClient, mockStorage, mockToolRegistry, config, eventBus);
  });

  it('should emit stream delta events', async () => {
    const deltas: StreamDelta[] = [
      { type: 'text_delta', text: 'Hello' },
      { type: 'text_delta', text: ' world' },
      { type: 'message_stop' },
    ];

    (mockClient.sendMessageStream as ReturnType<typeof vi.fn>).mockResolvedValue(
      createAsyncIterable(deltas)
    );

    const receivedDeltas: string[] = [];
    eventBus.on('llm:stream:delta', ({ text }) => {
      receivedDeltas.push(text);
    });

    const result = await agentLoop.runStreaming('test prompt');

    expect(result.status).toBe('completed');
    expect(result.finalResponse).toBe('Hello world');
    expect(receivedDeltas).toEqual(['Hello', ' world']);
  });

  it('should resume existing session', async () => {
    const existingSession = createMockSession('existing-session');
    existingSession.messages = [
      { role: 'user', content: 'First message', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'First response', timestamp: new Date().toISOString() },
    ];

    (mockStorage.load as ReturnType<typeof vi.fn>).mockResolvedValue(existingSession);

    const deltas: StreamDelta[] = [
      { type: 'text_delta', text: 'Continued response' },
      { type: 'message_stop' },
    ];
    (mockClient.sendMessageStream as ReturnType<typeof vi.fn>).mockResolvedValue(
      createAsyncIterable(deltas)
    );

    const result = await agentLoop.runStreaming('follow up', 'existing-session');

    expect(result.sessionId).toBe('existing-session');
    // Should not call create since we passed sessionId
    expect(mockStorage.create).not.toHaveBeenCalled();
  });

  it('should emit run:start and run:end events', async () => {
    const deltas: StreamDelta[] = [
      { type: 'text_delta', text: 'Done' },
      { type: 'message_stop' },
    ];
    (mockClient.sendMessageStream as ReturnType<typeof vi.fn>).mockResolvedValue(
      createAsyncIterable(deltas)
    );

    const events: string[] = [];
    eventBus.on('run:start', () => events.push('start'));
    eventBus.on('run:end', () => events.push('end'));

    await agentLoop.runStreaming('test');

    expect(events).toEqual(['start', 'end']);
  });

  it('should handle stream errors', async () => {
    (mockClient.sendMessageStream as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Stream failed')
    );

    const result = await agentLoop.runStreaming('test');

    expect(result.status).toBe('failed');
    expect(result.finalResponse).toContain('Stream failed');
  });
});
