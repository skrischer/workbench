// src/memory/__tests__/summarize-session.test.ts — Tests for summarizeSession function

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { summarizeSession } from '../session-summarizer.js';
import type { SessionSummaryInput, Message } from '../../types/index.js';
import type { RunMetadata } from '../../types/run.js';
import * as anthropicClientModule from '../../llm/anthropic-client.js';
import * as tokenRefreshModule from '../../llm/token-refresh.js';
import * as tokenStorageModule from '../../llm/token-storage.js';

describe('summarizeSession', () => {
  const createMockMessages = (count: number): Message[] => {
    const messages: Message[] = [];
    for (let i = 0; i < count; i++) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: Sample content for testing`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
      });
    }
    return messages;
  };

  const createMockRunMetadata = (): RunMetadata => ({
    id: 'run-123',
    startedAt: new Date(Date.now() - 60000).toISOString(),
    endedAt: new Date().toISOString(),
    status: 'completed',
    prompt: 'Test prompt',
    tokenUsage: {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    },
  });

  const createValidInput = (overrides?: Partial<SessionSummaryInput>): SessionSummaryInput => ({
    sessionId: 'session-123',
    runId: 'run-123',
    messages: createMockMessages(10),
    runMetadata: createMockRunMetadata(),
    filesModified: ['src/file1.ts', 'src/file2.ts'],
    ...overrides,
  });

  // Mock LLM client
  const mockSendMessage = vi.fn();

  beforeEach(() => {
    // Mock AnthropicClient
    vi.spyOn(anthropicClientModule, 'AnthropicClient').mockImplementation(() => ({
      sendMessage: mockSendMessage,
    } as any));

    // Mock TokenRefresher
    vi.spyOn(tokenRefreshModule, 'TokenRefresher').mockImplementation(() => ({
      ensureValidToken: vi.fn().mockResolvedValue('mock-token'),
    } as any));

    // Mock TokenStorage
    vi.spyOn(tokenStorageModule, 'TokenStorage').mockImplementation(() => ({
      load: vi.fn(),
      save: vi.fn(),
    } as any));

    // Default mock response
    mockSendMessage.mockResolvedValue({
      id: 'msg-123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            summary: 'Test session completed successfully.',
            keyDecisions: ['Decision 1', 'Decision 2'],
            errors: ['Error 1 was fixed'],
            learnings: ['Learning 1', 'Learning 2'],
          }),
        },
      ],
      model: 'claude-haiku-4',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Input Validation', () => {
    it('should throw error for invalid sessionId', async () => {
      const input = createValidInput({ sessionId: '' });
      await expect(summarizeSession(input)).rejects.toThrow('Invalid sessionId');
    });

    it('should throw error for invalid runId', async () => {
      const input = createValidInput({ runId: '' });
      await expect(summarizeSession(input)).rejects.toThrow('Invalid runId');
    });

    it('should throw error for invalid messages', async () => {
      const input = createValidInput({ messages: null as any });
      await expect(summarizeSession(input)).rejects.toThrow('Invalid messages');
    });

    it('should throw error for invalid runMetadata', async () => {
      const input = createValidInput({ runMetadata: null as any });
      await expect(summarizeSession(input)).rejects.toThrow('Invalid runMetadata');
    });
  });

  describe('Successful Summarization', () => {
    it('should generate structured summary with LLM', async () => {
      const input = createValidInput();
      const result = await summarizeSession(input);

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('session-123');
      expect(result.runId).toBe('run-123');
      expect(result.summary).toBe('Test session completed successfully.');
      expect(result.keyDecisions).toEqual(['Decision 1', 'Decision 2']);
      expect(result.errors).toEqual(['Error 1 was fixed']);
      expect(result.learnings).toEqual(['Learning 1', 'Learning 2']);
      expect(result.relatedFiles).toEqual(['src/file1.ts', 'src/file2.ts']);
      expect(mockSendMessage).toHaveBeenCalledOnce();
    });

    it('should include metadata with token usage and duration', async () => {
      const input = createValidInput();
      const result = await summarizeSession(input);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.tokenUsage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });
      expect(result.metadata.status).toBe('completed');
      expect(result.metadata.duration).toBeGreaterThan(0);
      expect(result.metadata.timestamp).toBeDefined();
    });

    it('should limit messages to last 50', async () => {
      const input = createValidInput({
        messages: createMockMessages(100), // Create 100 messages
      });

      await summarizeSession(input);

      // Check that the user prompt contains only 50 messages
      const callArgs = mockSendMessage.mock.calls[0];
      const userMessage = callArgs[0][0];
      expect(userMessage.content).toContain('last 50 messages');
    });

    it('should handle different run statuses', async () => {
      const statuses: Array<'running' | 'completed' | 'failed' | 'cancelled'> = [
        'running',
        'completed',
        'failed',
        'cancelled',
      ];

      for (const status of statuses) {
        const metadata = createMockRunMetadata();
        metadata.status = status;
        const input = createValidInput({ runMetadata: metadata });

        const result = await summarizeSession(input);
        expect(result.metadata.status).toBeDefined();
      }
    });
  });

  describe('Fallback Handling', () => {
    it('should generate fallback summary when LLM fails', async () => {
      mockSendMessage.mockRejectedValue(new Error('LLM API failed'));

      const input = createValidInput();
      const result = await summarizeSession(input);

      expect(result).toBeDefined();
      expect(result.summary).toContain('Session with');
      expect(result.keyDecisions).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.learnings).toEqual([]);
      expect(result.relatedFiles).toEqual(['src/file1.ts', 'src/file2.ts']);
    });

    it('should handle malformed JSON in LLM response', async () => {
      mockSendMessage.mockResolvedValue({
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'This is not valid JSON',
          },
        ],
        model: 'claude-haiku-4',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const input = createValidInput();
      const result = await summarizeSession(input);

      // Should fall back to basic summary
      expect(result.summary).toContain('Session with');
    });

    it('should include file context in fallback summary', async () => {
      mockSendMessage.mockRejectedValue(new Error('API error'));

      const input = createValidInput({
        filesModified: ['file1.ts', 'file2.ts', 'file3.ts'],
      });

      const result = await summarizeSession(input);
      expect(result.summary).toContain('Modified files');
    });

    it('should handle missing tokenUsage in metadata', async () => {
      const metadata = createMockRunMetadata();
      delete metadata.tokenUsage;
      const input = createValidInput({ runMetadata: metadata });

      const result = await summarizeSession(input);
      expect(result.metadata.tokenUsage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty filesModified array', async () => {
      const input = createValidInput({ filesModified: [] });
      const result = await summarizeSession(input);

      expect(result.relatedFiles).toEqual([]);
    });

    it('should handle missing endedAt in runMetadata', async () => {
      const metadata = createMockRunMetadata();
      delete metadata.endedAt;
      const input = createValidInput({ runMetadata: metadata });

      const result = await summarizeSession(input);
      expect(result.metadata.duration).toBeGreaterThan(0);
    });

    it('should extract JSON from text with surrounding content', async () => {
      mockSendMessage.mockResolvedValue({
        id: 'msg-123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `Here is the summary:
            
{
  "summary": "Extracted summary",
  "keyDecisions": ["Decision A"],
  "errors": [],
  "learnings": ["Learning X"]
}

This was generated from the session.`,
          },
        ],
        model: 'claude-haiku-4',
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const input = createValidInput();
      const result = await summarizeSession(input);

      expect(result.summary).toBe('Extracted summary');
      expect(result.keyDecisions).toEqual(['Decision A']);
    });
  });
});
