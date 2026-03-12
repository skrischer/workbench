// src/llm/__tests__/streaming.test.ts — Streaming types and sendMessageStream tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicClient } from '../anthropic-client.js';
import type { StreamDelta } from '../streaming.js';

// Mock token refresher
const mockTokenRefresher = {
  ensureValidToken: vi.fn().mockResolvedValue('test-token'),
};

describe('AnthropicClient.sendMessageStream', () => {
  let client: AnthropicClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    client = new AnthropicClient(mockTokenRefresher as any, {
      model: 'test-model',
      apiUrl: 'http://localhost:9999/v1/messages',
    });
  });

  it('should parse SSE text_delta events', async () => {
    const sseData = [
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n\n',
      'data: {"type":"content_block_stop","index":0}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of sseData) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    );

    const result = await client.sendMessageStream(
      [{ role: 'user', content: 'test' }]
    );

    const deltas: StreamDelta[] = [];
    for await (const delta of result) {
      deltas.push(delta);
    }

    expect(deltas).toEqual([
      { type: 'text_delta', text: 'Hello' },
      { type: 'text_delta', text: ' world' },
      { type: 'content_block_stop' },
      { type: 'message_stop' },
    ]);
  });

  it('should parse tool_use events', async () => {
    const sseData = [
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"tool-1","name":"read_file","input":{}}}\n\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"path\\""}}\n\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":": \\"/test\\"}"}}\n\n',
      'data: {"type":"content_block_stop","index":0}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of sseData) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(stream, { status: 200 })
    );

    const result = await client.sendMessageStream(
      [{ role: 'user', content: 'test' }]
    );

    const deltas: StreamDelta[] = [];
    for await (const delta of result) {
      deltas.push(delta);
    }

    expect(deltas[0]).toEqual({
      type: 'tool_use_start',
      toolName: 'read_file',
      toolId: 'tool-1',
    });

    // Input deltas
    expect(deltas[1]?.type).toBe('tool_input_delta');
    expect(deltas[2]?.type).toBe('tool_input_delta');
  });

  it('should throw on non-200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Rate limit exceeded', { status: 429 })
    );

    await expect(
      client.sendMessageStream([{ role: 'user', content: 'test' }])
    ).rejects.toThrow('429');
  });

  it('should support abort', async () => {
    const sseData = 'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n';
    const encoder = new TextEncoder();

    // Slow stream that never completes
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseData));
        // Don't close — simulates long stream
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(stream, { status: 200 })
    );

    const result = await client.sendMessageStream(
      [{ role: 'user', content: 'test' }]
    );

    // Abort should not throw
    result.abort();
  });
});
