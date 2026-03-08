// src/memory/__tests__/session-summarizer.test.ts — Session Summarizer Tests

import { describe, it, expect, vi } from 'vitest';
import { SessionSummarizer } from '../session-summarizer.js';
import type { Message } from '../../types/index.js';
import type { LLMCallback } from '../session-summarizer.js';

describe('SessionSummarizer', () => {
  const createMockMessages = (count: number): Message[] => {
    const messages: Message[] = [];
    for (let i = 0; i < count; i++) {
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
      });
    }
    return messages;
  };

  it('should generate summary successfully with mock LLM', async () => {
    const mockLLM: LLMCallback = vi.fn(async (systemPrompt, userPrompt) => {
      return 'Session summary: User asked questions, assistant provided answers. Tools used: read_file, write_file. Key insights: Learned about TypeScript configuration. Outcome: Successfully configured project.';
    });

    const summarizer = new SessionSummarizer(mockLLM);
    const messages = createMockMessages(5);
    const result = await summarizer.summarize(messages, 'test-session-123');

    expect(result).not.toBeNull();
    expect(result?.type).toBe('session');
    expect(result?.content).toContain('Session summary');
    expect(result?.source.sessionId).toBe('test-session-123');
    expect(result?.source.type).toBe('session');
    expect(result?.metadata?.messageCount).toBe(5);
    expect(mockLLM).toHaveBeenCalledOnce();
  });

  it('should extract tags from summary content', async () => {
    const mockLLM: LLMCallback = vi.fn(async () => {
      return 'The agent configured TypeScript settings and wrote documentation. Tools like read_file and write_file were used extensively.';
    });

    const summarizer = new SessionSummarizer(mockLLM);
    const messages = createMockMessages(5);
    const result = await summarizer.summarize(messages, 'test-session-456');

    expect(result).not.toBeNull();
    expect(result?.tags).toBeDefined();
    expect(result?.tags.length).toBeGreaterThan(0);
    // Should contain meaningful words like 'typescript', 'documentation', 'configured', etc.
    expect(result?.tags.some((tag) => tag.length >= 3)).toBe(true);
  });

  it('should generate fallback summary when LLM fails', async () => {
    const mockLLM: LLMCallback = vi.fn(async () => {
      throw new Error('LLM API failed');
    });

    const summarizer = new SessionSummarizer(mockLLM);
    const messages: Message[] = [
      { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Hi there', timestamp: new Date().toISOString() },
      { role: 'tool', content: 'Tool: read_file - Success', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Done', timestamp: new Date().toISOString() },
    ];

    const result = await summarizer.summarize(messages, 'test-session-789');

    expect(result).not.toBeNull();
    expect(result?.content).toContain('Session with 4 messages');
    expect(result?.type).toBe('session');
    expect(result?.tags).toBeDefined();
    expect(result?.tags.length).toBeGreaterThan(0);
  });

  it('should return null for short sessions (< 3 messages)', async () => {
    const mockLLM: LLMCallback = vi.fn(async () => 'Should not be called');

    const summarizer = new SessionSummarizer(mockLLM);
    const messages = createMockMessages(2); // Only 2 messages

    const result = await summarizer.summarize(messages, 'short-session');

    expect(result).toBeNull();
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it('should respect custom minMessages configuration', async () => {
    const mockLLM: LLMCallback = vi.fn(async () => 'Test summary');

    const summarizer = new SessionSummarizer(mockLLM, { minMessages: 5 });
    const messages = createMockMessages(4); // 4 messages, below custom threshold

    const result = await summarizer.summarize(messages, 'config-test');

    expect(result).toBeNull();
    expect(mockLLM).not.toHaveBeenCalled();
  });

  it('should throw error for invalid sessionId', async () => {
    const mockLLM: LLMCallback = vi.fn(async () => 'Test summary');

    const summarizer = new SessionSummarizer(mockLLM);
    const messages = createMockMessages(5);

    await expect(summarizer.summarize(messages, '')).rejects.toThrow('Invalid sessionId');
    await expect(summarizer.summarize(messages, null as any)).rejects.toThrow('Invalid sessionId');
  });

  it('should include message metadata in MemoryEntry', async () => {
    const mockLLM: LLMCallback = vi.fn(async () => 'Test summary with metadata');

    const summarizer = new SessionSummarizer(mockLLM);
    const messages = createMockMessages(7);
    const result = await summarizer.summarize(messages, 'metadata-test');

    expect(result).not.toBeNull();
    expect(result?.metadata).toBeDefined();
    expect(result?.metadata?.messageCount).toBe(7);
    expect(result?.metadata?.sessionId).toBe('metadata-test');
  });

  it('should limit number of extracted tags', async () => {
    const mockLLM: LLMCallback = vi.fn(async () => {
      return 'TypeScript configuration documentation testing automation deployment monitoring logging debugging profiling optimization performance scalability reliability maintainability'.repeat(5);
    });

    const summarizer = new SessionSummarizer(mockLLM, { maxTags: 5 });
    const messages = createMockMessages(5);
    const result = await summarizer.summarize(messages, 'tag-limit-test');

    expect(result).not.toBeNull();
    expect(result?.tags.length).toBeLessThanOrEqual(5);
  });
});
