// src/tools/__tests__/memory-tools.test.ts — Tests for Remember and Recall Tools

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RememberTool } from '../remember.js';
import { RecallTool } from '../recall.js';
import type { LanceDBMemoryStore } from '../../memory/lancedb-store.js';
import type { MemoryEntry, MemoryQuery, MemoryResult } from '../../types/memory.js';

/**
 * Mock MemoryStore for testing
 */
class MockMemoryStore implements Partial<LanceDBMemoryStore> {
  private entries: MemoryEntry[] = [];
  private initialized = false;

  async init(): Promise<void> {
    this.initialized = true;
  }

  async add(entry: Partial<MemoryEntry> & { content: string; type: any }): Promise<MemoryEntry> {
    if (!this.initialized) {
      await this.init();
    }

    const fullEntry: MemoryEntry = {
      id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: entry.type,
      content: entry.content,
      summary: entry.summary,
      tags: entry.tags ?? [],
      source: entry.source ?? { type: 'user' },
      createdAt: entry.createdAt ?? new Date().toISOString(),
      updatedAt: entry.updatedAt ?? new Date().toISOString(),
      metadata: entry.metadata,
    };

    this.entries.push(fullEntry);
    return fullEntry;
  }

  async search(query: MemoryQuery): Promise<MemoryResult[]> {
    if (!this.initialized) {
      await this.init();
    }

    let results = this.entries;

    // Filter by type if specified
    if (query.type) {
      results = results.filter((entry) => entry.type === query.type);
    }

    // Filter by tags if specified
    if (query.tags && query.tags.length > 0) {
      results = results.filter((entry) =>
        query.tags!.some((tag) => entry.tags.includes(tag))
      );
    }

    // Simple text matching (case-insensitive)
    const queryLower = query.text.toLowerCase();
    const matchedResults = results
      .map((entry) => {
        const contentLower = entry.content.toLowerCase();
        const score = contentLower.includes(queryLower) ? 0.9 : 0.0;
        return { entry, score };
      })
      .filter((result) => result.score > 0 && result.score >= (query.minScore ?? 0))
      .sort((a, b) => b.score - a.score)
      .slice(0, query.limit ?? 10);

    return matchedResults;
  }

  // Utility method for tests
  clear(): void {
    this.entries = [];
  }

  getEntries(): MemoryEntry[] {
    return [...this.entries];
  }
}

describe('RememberTool', () => {
  let mockStore: MockMemoryStore;
  let tool: RememberTool;

  beforeEach(() => {
    mockStore = new MockMemoryStore();
    tool = new RememberTool(mockStore as any);
  });

  it('should save content to memory store', async () => {
    const result = await tool.execute({
      content: 'Important fact: TypeScript is awesome',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Remembered:');
    expect(result.output).toContain('TypeScript is awesome');
    expect(result.metadata?.id).toBeDefined();
    expect(result.metadata?.type).toBe('knowledge');
    expect(result.metadata?.tags).toEqual([]);
    
    const entries = mockStore.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe('Important fact: TypeScript is awesome');
  });

  it('should save content with custom type and tags', async () => {
    const result = await tool.execute({
      content: 'User prefers dark mode',
      type: 'preference',
      tags: ['ui', 'settings'],
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.type).toBe('preference');
    expect(result.metadata?.tags).toEqual(['ui', 'settings']);
    
    const entries = mockStore.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('preference');
    expect(entries[0].tags).toEqual(['ui', 'settings']);
  });

  it('should handle long content with truncation in output', async () => {
    const longContent = 'A'.repeat(200);
    const result = await tool.execute({ content: longContent });

    expect(result.success).toBe(true);
    expect(result.output).toContain('...');
    expect(result.output.length).toBeLessThan(longContent.length + 20);
    
    const entries = mockStore.getEntries();
    expect(entries[0].content).toBe(longContent); // Full content stored
  });
});

describe('RecallTool', () => {
  let mockStore: MockMemoryStore;
  let tool: RecallTool;

  beforeEach(() => {
    mockStore = new MockMemoryStore();
    tool = new RecallTool(mockStore as any);
  });

  it('should return empty result when no memories match', async () => {
    const result = await tool.execute({
      query: 'nonexistent query',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('No relevant memories found');
    expect(result.metadata?.count).toBe(0);
  });

  it('should search and return matching memories', async () => {
    // Add some memories
    await mockStore.add({
      content: 'TypeScript is a superset of JavaScript',
      type: 'knowledge',
      tags: ['typescript', 'programming'],
    });
    await mockStore.add({
      content: 'Python is great for data science',
      type: 'knowledge',
      tags: ['python', 'data'],
    });

    const result = await tool.execute({
      query: 'TypeScript',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Found 1 relevant memory');
    expect(result.output).toContain('TypeScript is a superset of JavaScript');
    expect(result.output).toContain('[knowledge]');
    expect(result.output).toContain('[typescript, programming]');
    expect(result.metadata?.count).toBe(1);
  });

  it('should filter by type', async () => {
    await mockStore.add({
      content: 'Project uses Vite',
      type: 'project',
      tags: ['build'],
    });
    await mockStore.add({
      content: 'User prefers light theme',
      type: 'preference',
      tags: ['ui'],
    });

    const result = await tool.execute({
      query: 'uses',
      type: 'project',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Found 1 relevant memory');
    expect(result.output).toContain('Project uses Vite');
    expect(result.output).not.toContain('light theme');
  });

  it('should respect limit parameter', async () => {
    // Add multiple memories
    for (let i = 0; i < 10; i++) {
      await mockStore.add({
        content: `Memory ${i}`,
        type: 'knowledge',
        tags: [],
      });
    }

    const result = await tool.execute({
      query: 'Memory',
      limit: 3,
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.count).toBeLessThanOrEqual(3);
  });

  it('should use default limit of 5', async () => {
    // Add multiple memories
    for (let i = 0; i < 10; i++) {
      await mockStore.add({
        content: `Entry ${i}`,
        type: 'knowledge',
        tags: [],
      });
    }

    const result = await tool.execute({
      query: 'Entry',
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.count).toBeLessThanOrEqual(5);
  });
});

describe('Remember + Recall Roundtrip', () => {
  let mockStore: MockMemoryStore;
  let rememberTool: RememberTool;
  let recallTool: RecallTool;

  beforeEach(() => {
    mockStore = new MockMemoryStore();
    rememberTool = new RememberTool(mockStore as any);
    recallTool = new RecallTool(mockStore as any);
  });

  it('should successfully store and retrieve memories', async () => {
    // Remember multiple facts
    await rememberTool.execute({
      content: 'The project uses LanceDB for vector storage',
      type: 'project',
      tags: ['database', 'vectors'],
    });

    await rememberTool.execute({
      content: 'User favorite color is blue',
      type: 'preference',
      tags: ['user', 'color'],
    });

    // Recall project-related info
    const projectResult = await recallTool.execute({
      query: 'LanceDB',
      type: 'project',
    });

    expect(projectResult.success).toBe(true);
    expect(projectResult.output).toContain('LanceDB');
    expect(projectResult.metadata?.count).toBe(1);

    // Recall all memories
    const allResult = await recallTool.execute({
      query: 'user',
    });

    expect(allResult.success).toBe(true);
    expect(allResult.metadata?.count).toBeGreaterThan(0);
  });
});
