// src/llm/__tests__/anthropic-client.test.ts — Tests for AnthropicClient

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnthropicClient } from '../anthropic-client.js';
import { TokenRefresher } from '../token-refresh.js';
import type { LLMMessage, LLMToolDef, LLMResponse, ContentBlock } from '../../types/index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('AnthropicClient', () => {
  let mockTokenRefresher: TokenRefresher;
  let client: AnthropicClient;
  let testMessages: LLMMessage[];
  let testTools: LLMToolDef[];

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock TokenRefresher
    mockTokenRefresher = {
      ensureValidToken: vi.fn().mockResolvedValue('test-access-token')
    } as unknown as TokenRefresher;

    client = new AnthropicClient(mockTokenRefresher);

    // Setup test data
    testMessages = [
      { role: 'user', content: 'Hello, Claude!' }
    ];

    testTools = [
      {
        name: 'get_weather',
        description: 'Get the current weather',
        input_schema: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          },
          required: ['location']
        }
      }
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send request with correct x-api-key header', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      })
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await client.sendMessage(testMessages);

    // Verify fetch was called with x-api-key and OAuth beta headers
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1]?.headers).toMatchObject({
      'x-api-key': 'test-access-token',
      'anthropic-beta': 'oauth-2025-04-20,claude-code-20250219'
    });
  });

  it('should send request with correct anthropic-version header', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      })
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await client.sendMessage(testMessages);

    // Verify anthropic-version header
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1]?.headers).toMatchObject({
      'anthropic-version': '2023-06-01'
    });
  });

  it('should include Content-Type header', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      })
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await client.sendMessage(testMessages);

    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[1]?.headers).toMatchObject({
      'Content-Type': 'application/json'
    });
  });

  it('should successfully parse text response', async () => {
    const mockResponseData: LLMResponse = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello! How can I help you?' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 8 }
    };

    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => mockResponseData
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    const response = await client.sendMessage(testMessages);

    expect(response).toEqual(mockResponseData);
    expect(response.content[0]).toMatchObject({
      type: 'text',
      text: 'Hello! How can I help you?'
    });
  });

  it('should successfully parse tool_use response', async () => {
    const toolUseContent: ContentBlock[] = [
      {
        type: 'text',
        text: 'Let me check the weather for you.'
      },
      {
        type: 'tool_use',
        id: 'toolu_123',
        name: 'get_weather',
        input: { location: 'San Francisco' }
      }
    ];

    const mockResponseData: LLMResponse = {
      id: 'msg_456',
      type: 'message',
      role: 'assistant',
      content: toolUseContent,
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'tool_use',
      usage: { input_tokens: 150, output_tokens: 50 }
    };

    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => mockResponseData
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    const response = await client.sendMessage(testMessages, testTools);

    expect(response).toEqual(mockResponseData);
    expect(response.stop_reason).toBe('tool_use');
    expect(response.content[1]).toMatchObject({
      type: 'tool_use',
      id: 'toolu_123',
      name: 'get_weather',
      input: { location: 'San Francisco' }
    });
  });

  it('should throw error on 429 rate limit', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded'
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await expect(client.sendMessage(testMessages)).rejects.toThrow('Rate limit exceeded');
  });

  it('should throw error on 401 authentication failure', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: async () => 'Invalid API key'
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await expect(client.sendMessage(testMessages)).rejects.toThrow('Authentication failed');
  });

  it('should throw error on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Failed to fetch'));

    await expect(client.sendMessage(testMessages)).rejects.toThrow(
      'Network error during API call: Error: Failed to fetch'
    );
  });

  it('should include tools in request when provided', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      })
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await client.sendMessage(testMessages, testTools);

    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1]?.body as string);
    
    expect(requestBody.tools).toEqual(testTools);
  });

  it('should not include tools field when tools array is empty', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      })
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await client.sendMessage(testMessages, []);

    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1]?.body as string);
    
    expect(requestBody.tools).toBeUndefined();
  });

  it('should include system prompt when provided', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      })
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await client.sendMessage(testMessages, undefined, { system: 'You are a helpful assistant.' });

    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1]?.body as string);
    
    expect(requestBody.system).toBe('You are a helpful assistant.');
  });

  it('should use custom model when provided in config', async () => {
    const customClient = new AnthropicClient(mockTokenRefresher, { model: 'claude-opus-4-20250514' });

    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-opus-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      })
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await customClient.sendMessage(testMessages);

    const fetchCall = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchCall[1]?.body as string);
    
    expect(requestBody.model).toBe('claude-opus-4-20250514');
  });

  it('should handle 500 server error', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await expect(client.sendMessage(testMessages)).rejects.toThrow(
      'Anthropic API server error: 500 - Internal Server Error'
    );
  });

  it('should handle invalid JSON response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token');
      }
    };
    mockFetch.mockResolvedValue(mockResponse as unknown as Response);

    await expect(client.sendMessage(testMessages)).rejects.toThrow(
      'Failed to parse API response'
    );
  });

  it('should use correct API URL from config', async () => {
    const customClient = new AnthropicClient(mockTokenRefresher, {
      apiUrl: 'https://custom-api.example.com/messages'
    });

    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      })
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await customClient.sendMessage(testMessages);

    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[0]).toBe('https://custom-api.example.com/messages');
  });
});
