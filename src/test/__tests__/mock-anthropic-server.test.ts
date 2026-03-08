import { describe, it, expect } from 'vitest';
import { createMockAnthropicServer } from '../mock-anthropic-server.js';

describe('Mock Anthropic Server', () => {
  it('should start server, respond to POST /v1/messages, and record calls', async () => {
    // Arrange: Create mock response
    const mockResponse = {
      id: 'msg_test123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Hello from mock server!',
        },
      ],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 5,
      },
    };

    // Act: Create server with fixture
    const server = await createMockAnthropicServer([
      {
        response: mockResponse,
        status: 200,
      },
    ]);

    try {
      // Act: Send POST request
      const response = await fetch(`${server.url}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          messages: [
            {
              role: 'user',
              content: 'Hello',
            },
          ],
          max_tokens: 1024,
        }),
      });

      const data = await response.json();

      // Assert: Response matches fixture
      expect(response.status).toBe(200);
      expect(data).toEqual(mockResponse);

      // Assert: server.calls has 1 entry
      expect(server.calls).toHaveLength(1);
      expect((server.calls[0] as any).body).toMatchObject({
        model: 'claude-sonnet-4-20250514',
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        max_tokens: 1024,
      });
    } finally {
      // Cleanup: Close server
      await server.close();
    }
  });

  it('should return error when no mock response is configured', async () => {
    // Act: Create server with empty responses
    const server = await createMockAnthropicServer([]);

    try {
      // Act: Send POST request
      const response = await fetch(`${server.url}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      const data = await response.json();

      // Assert: Returns 500 error
      expect(response.status).toBe(500);
      expect(data).toEqual({
        type: 'error',
        error: {
          type: 'internal_error',
          message: 'No mock response configured',
        },
      });
    } finally {
      await server.close();
    }
  });

  it('should support custom match function', async () => {
    // Arrange: Create server with conditional response
    const server = await createMockAnthropicServer([
      {
        match: (body) => {
          const messages = body.messages as Array<{ content: string }>;
          return messages[0].content === 'Special request';
        },
        response: {
          id: 'msg_special',
          type: 'message',
          content: [{ type: 'text', text: 'Special response!' }],
        },
      },
    ]);

    try {
      // Act: Send special request that matches
      const response1 = await fetch(`${server.url}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Special request' }],
        }),
      });
      const data1 = await response1.json();

      // Assert: Gets special response
      expect(data1.id).toBe('msg_special');

      // Act: Send another special request
      const response2 = await fetch(`${server.url}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Special request' }],
        }),
      });
      const data2 = await response2.json();

      // Assert: Still gets special response (matcher always applies)
      expect(data2.id).toBe('msg_special');
    } finally {
      await server.close();
    }
  });
});
