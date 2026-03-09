// src/memory/__tests__/memory-events.test.ts — Memory Events Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LanceDBMemoryStore } from '../lancedb-store.js';
import { SessionSummarizer } from '../session-summarizer.js';
import { TypedEventBus } from '../../events/event-bus.js';
import type { MemoryEntry } from '../../types/memory.js';
import type { Message } from '../../types/index.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Memory Events', () => {
  let tempDir: string;
  let eventBus: TypedEventBus;

  beforeEach(async () => {
    // Create temp directory for each test
    tempDir = await mkdtemp(join(tmpdir(), 'memory-events-test-'));
    eventBus = new TypedEventBus();
  });

  afterEach(async () => {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('LanceDBMemoryStore', () => {
    it('should emit memory:added event when adding an entry', async () => {
      const store = new LanceDBMemoryStore({ dbPath: tempDir, tableName: 'test-memories', eventBus });
      await store.init();

      // Set up event listener
      const eventSpy = vi.fn();
      eventBus.on('memory:added', eventSpy);

      // Add memory entry
      const entry = await store.add({
        type: 'knowledge',
        content: 'Test knowledge entry',
        tags: ['test', 'knowledge'],
      });

      // Verify event was emitted with correct payload
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith({
        id: entry.id,
        type: 'knowledge',
        tags: ['test', 'knowledge'],
      });

      await store.close();
    });

    it('should emit memory:searched event when searching', async () => {
      const store = new LanceDBMemoryStore({ dbPath: tempDir, tableName: 'test-memories', eventBus });
      await store.init();

      // Add some entries first
      await store.add({
        type: 'knowledge',
        content: 'Test knowledge about TypeScript',
        tags: ['typescript'],
      });
      await store.add({
        type: 'knowledge',
        content: 'Test knowledge about Node.js',
        tags: ['nodejs'],
      });

      // Set up event listener
      const eventSpy = vi.fn();
      eventBus.on('memory:searched', eventSpy);

      // Search for entries
      const results = await store.search({
        text: 'TypeScript',
        limit: 5,
      });

      // Verify event was emitted with correct payload
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith({
        query: 'TypeScript',
        resultCount: results.length,
      });

      await store.close();
    });

    it('should not crash when adding entry without EventBus', async () => {
      // Create store without event bus
      const store = new LanceDBMemoryStore({ dbPath: tempDir, tableName: 'test-memories' });
      await store.init();

      // This should not throw
      const entry = await store.add({
        type: 'knowledge',
        content: 'Test knowledge without event bus',
        tags: ['test'],
      });

      expect(entry).toBeDefined();
      expect(entry.id).toBeDefined();
      expect(entry.type).toBe('knowledge');

      await store.close();
    });

    it('should not crash when searching without EventBus', async () => {
      // Create store without event bus
      const store = new LanceDBMemoryStore({ dbPath: tempDir, tableName: 'test-memories' });
      await store.init();

      // Add entry first
      await store.add({
        type: 'knowledge',
        content: 'Test knowledge for search',
        tags: ['test'],
      });

      // This should not throw
      const results = await store.search({
        text: 'test knowledge',
        limit: 5,
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      await store.close();
    });
  });

  describe('SessionSummarizer', () => {
    it('should emit memory:summarized event after summarizing session', async () => {
      const mockLLM = vi.fn().mockResolvedValue('Session summary: User discussed TypeScript features');
      const summarizer = new SessionSummarizer(mockLLM, { eventBus });

      // Set up event listener
      const eventSpy = vi.fn();
      eventBus.on('memory:summarized', eventSpy);

      // Create test messages
      const messages: Message[] = [
        { role: 'user', content: 'Tell me about TypeScript', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'TypeScript is a typed superset of JavaScript', timestamp: new Date().toISOString() },
        { role: 'user', content: 'What are its benefits?', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'TypeScript provides type safety and better IDE support', timestamp: new Date().toISOString() },
      ];

      // Summarize session
      const summary = await summarizer.summarize(messages, 'test-session-123');

      // Verify event was emitted with correct payload
      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy).toHaveBeenCalledWith({
        sessionId: 'test-session-123',
        summaryId: summary!.id,
        messageCount: 4,
      });
    });

    it('should not crash when summarizing without EventBus', async () => {
      const mockLLM = vi.fn().mockResolvedValue('Session summary: User discussed Node.js features');
      // Create summarizer without event bus
      const summarizer = new SessionSummarizer(mockLLM);

      // Create test messages
      const messages: Message[] = [
        { role: 'user', content: 'Tell me about Node.js', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Node.js is a JavaScript runtime', timestamp: new Date().toISOString() },
        { role: 'user', content: 'What are its use cases?', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Node.js is great for building APIs and CLIs', timestamp: new Date().toISOString() },
      ];

      // This should not throw
      const summary = await summarizer.summarize(messages, 'test-session-456');

      expect(summary).toBeDefined();
      expect(summary!.type).toBe('session');
      expect(summary!.metadata?.sessionId).toBe('test-session-456');
    });

    it('should not emit event when session is too short', async () => {
      const mockLLM = vi.fn().mockResolvedValue('Short summary');
      const summarizer = new SessionSummarizer(mockLLM, { eventBus, minMessages: 3 });

      // Set up event listener
      const eventSpy = vi.fn();
      eventBus.on('memory:summarized', eventSpy);

      // Create short message list (below minMessages threshold)
      const messages: Message[] = [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() },
      ];

      // Summarize session
      const summary = await summarizer.summarize(messages, 'short-session');

      // Summary should be null for short sessions
      expect(summary).toBeNull();
      // Event should not have been emitted
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });
});
