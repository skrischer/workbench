// src/memory/__tests__/lancedb-store.test.ts — LanceDB Memory Store Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { LanceDBMemoryStore } from '../lancedb-store.js';
import type { MemoryEntry, MemoryType } from '../../types/memory.js';

describe('LanceDBMemoryStore', () => {
  let store: LanceDBMemoryStore;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'lancedb-test-'));
    store = new LanceDBMemoryStore({ dbPath: testDir });
    await store.init();
  });

  afterEach(async () => {
    // Clean up
    await store.close();
    await rm(testDir, { recursive: true, force: true });
  });

  it('should initialize database and table', async () => {
    // Store is already initialized in beforeEach
    // Try to add an entry to verify it works
    const entry = await store.add({
      type: 'session',
      content: 'Test initialization',
    });

    expect(entry.id).toBeDefined();
    expect(entry.content).toBe('Test initialization');
  });

  it('should perform CRUD roundtrip successfully', async () => {
    // CREATE
    const created = await store.add({
      type: 'knowledge',
      content: 'TypeScript is a typed superset of JavaScript',
      summary: 'TypeScript basics',
      tags: ['typescript', 'programming'],
      source: { type: 'user' },
      metadata: { priority: 'high' },
    });

    expect(created.id).toBeDefined();
    expect(created.content).toBe('TypeScript is a typed superset of JavaScript');
    expect(created.tags).toEqual(['typescript', 'programming']);

    // READ
    const retrieved = await store.get(created.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.content).toBe(created.content);
    expect(retrieved!.metadata).toEqual({ priority: 'high' });

    // UPDATE
    const updated = await store.update(created.id, {
      content: 'TypeScript is a typed superset of JavaScript with excellent tooling',
      tags: ['typescript', 'programming', 'tooling'],
    });

    expect(updated).not.toBeNull();
    expect(updated!.content).toBe('TypeScript is a typed superset of JavaScript with excellent tooling');
    expect(updated!.tags).toEqual(['typescript', 'programming', 'tooling']);
    expect(updated!.updatedAt).not.toBe(created.updatedAt);

    // DELETE
    const deleted = await store.delete(created.id);
    expect(deleted).toBe(true);

    // Verify deletion
    const notFound = await store.get(created.id);
    expect(notFound).toBeNull();
  });

  it('should perform vector search and return relevant results', async () => {
    // Add multiple entries
    await store.add({
      type: 'knowledge',
      content: 'Python is a high-level programming language',
    });

    await store.add({
      type: 'knowledge',
      content: 'JavaScript is used for web development',
    });

    await store.add({
      type: 'knowledge',
      content: 'TypeScript adds static typing to JavaScript',
    });

    // Search for TypeScript-related content
    const results = await store.search({
      text: 'TypeScript static types',
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].entry.content).toContain('TypeScript');

    // Verify results are sorted by score (descending)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('should filter search results by type', async () => {
    // Add entries of different types
    await store.add({
      type: 'session',
      content: 'User asked about React hooks',
    });

    await store.add({
      type: 'knowledge',
      content: 'React hooks are functions that let you use state',
    });

    await store.add({
      type: 'project',
      content: 'Building a React application with hooks',
    });

    // Search only in knowledge type
    const results = await store.search({
      text: 'React hooks',
      type: 'knowledge',
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => {
      expect(result.entry.type).toBe('knowledge');
    });
  });

  it('should filter search results by tags', async () => {
    // Add entries with different tags
    await store.add({
      type: 'knowledge',
      content: 'React is a JavaScript library',
      tags: ['react', 'javascript', 'frontend'],
    });

    await store.add({
      type: 'knowledge',
      content: 'Vue is a progressive framework',
      tags: ['vue', 'javascript', 'frontend'],
    });

    await store.add({
      type: 'knowledge',
      content: 'Django is a Python web framework',
      tags: ['django', 'python', 'backend'],
    });

    // Search with tag filter
    const results = await store.search({
      text: 'web framework',
      tags: ['python'],
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    results.forEach((result) => {
      expect(result.entry.tags).toContain('python');
    });
  });

  it('should re-embed content when updated', async () => {
    // Add initial entry
    const entry = await store.add({
      type: 'knowledge',
      content: 'Original content about cats',
    });

    // Search for cats - should find it
    const catsResults = await store.search({
      text: 'cats',
      limit: 5,
    });

    expect(catsResults.length).toBeGreaterThan(0);
    expect(catsResults[0].entry.id).toBe(entry.id);

    // Update content to be about dogs
    await store.update(entry.id, {
      content: 'Updated content about dogs',
    });

    // Search for dogs - should find the updated entry
    const dogsResults = await store.search({
      text: 'dogs',
      limit: 5,
    });

    expect(dogsResults.length).toBeGreaterThan(0);
    const found = dogsResults.find((r) => r.entry.id === entry.id);
    expect(found).toBeDefined();
    expect(found!.entry.content).toBe('Updated content about dogs');
  });

  it('should list entries by type', async () => {
    // Add entries of different types
    await store.add({
      type: 'session',
      content: 'Session entry 1',
    });

    await store.add({
      type: 'session',
      content: 'Session entry 2',
    });

    await store.add({
      type: 'knowledge',
      content: 'Knowledge entry',
    });

    await store.add({
      type: 'project',
      content: 'Project entry',
    });

    // List only session entries
    const sessions = await store.listByType('session');

    expect(sessions.length).toBe(2);
    sessions.forEach((entry) => {
      expect(entry.type).toBe('session');
    });
  });

  it('should handle empty database gracefully', async () => {
    // Search in empty database
    const results = await store.search({
      text: 'nonexistent content',
      limit: 5,
    });

    expect(results).toEqual([]);

    // Get nonexistent entry
    const entry = await store.get('nonexistent-id');
    expect(entry).toBeNull();

    // Update nonexistent entry
    const updated = await store.update('nonexistent-id', {
      content: 'new content',
    });
    expect(updated).toBeNull();

    // Delete nonexistent entry
    const deleted = await store.delete('nonexistent-id');
    expect(deleted).toBe(false);

    // List entries by type in empty database
    const entries = await store.listByType('session');
    expect(entries).toEqual([]);
  });

  it('should respect minScore filter in search', async () => {
    // Add some entries
    await store.add({
      type: 'knowledge',
      content: 'Machine learning is a subset of artificial intelligence',
    });

    await store.add({
      type: 'knowledge',
      content: 'The weather is nice today',
    });

    // Search with high minScore - should filter out low-relevance results
    const highScoreResults = await store.search({
      text: 'machine learning AI',
      minScore: 0.5,
      limit: 10,
    });

    // All results should have score >= 0.5
    highScoreResults.forEach((result) => {
      expect(result.score).toBeGreaterThanOrEqual(0.5);
    });

    // Search with low minScore - should return more results
    const lowScoreResults = await store.search({
      text: 'machine learning AI',
      minScore: 0.1,
      limit: 10,
    });

    expect(lowScoreResults.length).toBeGreaterThanOrEqual(highScoreResults.length);
  });

  it('should preserve entry metadata through updates', async () => {
    // Add entry with metadata
    const entry = await store.add({
      type: 'knowledge',
      content: 'Original content',
      metadata: { author: 'Alice', version: 1 },
    });

    // Update without changing metadata
    await store.update(entry.id, {
      summary: 'Added summary',
    });

    const retrieved = await store.get(entry.id);
    expect(retrieved!.metadata).toEqual({ author: 'Alice', version: 1 });

    // Update with new metadata
    await store.update(entry.id, {
      metadata: { author: 'Bob', version: 2 },
    });

    const updated = await store.get(entry.id);
    expect(updated!.metadata).toEqual({ author: 'Bob', version: 2 });
  });
});
