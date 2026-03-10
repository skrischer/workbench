// src/memory/__tests__/memory-cleanup.test.ts — Memory Cleanup Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LanceDBMemoryStore } from '../lancedb-store.js';
import { cleanupOldMemories, getDefaultRetentionDays } from '../memory-cleanup.js';
import type { MemoryEntry } from '../../types/memory.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

describe('Memory Cleanup', () => {
  let store: LanceDBMemoryStore;
  let testDbPath: string;

  beforeEach(async () => {
    // Create temporary test database
    testDbPath = join(tmpdir(), `test-cleanup-${randomUUID()}`);
    store = new LanceDBMemoryStore({ dbPath: testDbPath });
    await store.init();
  });

  afterEach(async () => {
    await store.close();
  });

  describe('cleanupOldMemories', () => {
    it('should delete memories older than retention period', async () => {
      // Create old memory (100 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      await store.add({
        type: 'session',
        content: 'Old memory',
        createdAt: oldDate.toISOString(),
      });

      // Create recent memory (10 days ago)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      await store.add({
        type: 'session',
        content: 'Recent memory',
        createdAt: recentDate.toISOString(),
      });

      // Cleanup with 90 day retention
      const result = await cleanupOldMemories(
        { retentionDays: 90 },
        store
      );

      expect(result.deleted).toBe(1);
      expect(result.kept).toBe(1);
    });

    it('should respect bookmarked memories', async () => {
      // Create old bookmarked memory (100 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      await store.add({
        type: 'session',
        content: 'Bookmarked memory',
        createdAt: oldDate.toISOString(),
        metadata: { bookmarked: true },
      });

      // Create old unbookmarked memory (100 days ago)
      await store.add({
        type: 'session',
        content: 'Unbookmarked memory',
        createdAt: oldDate.toISOString(),
        metadata: { bookmarked: false },
      });

      // Cleanup with 90 day retention
      const result = await cleanupOldMemories(
        { retentionDays: 90, respectBookmarks: true },
        store
      );

      expect(result.deleted).toBe(1);
      expect(result.kept).toBe(1);
    });

    it('should perform dry run without deleting', async () => {
      // Create old memory (100 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      await store.add({
        type: 'session',
        content: 'Old memory',
        createdAt: oldDate.toISOString(),
      });

      // Dry run
      const result = await cleanupOldMemories(
        { retentionDays: 90, dryRun: true },
        store
      );

      expect(result.deleted).toBe(1);
      expect(result.kept).toBe(0);

      // Verify memory still exists
      const memories = await store.listByType('session');
      expect(memories.length).toBe(1);
    });

    it('should handle empty database', async () => {
      const result = await cleanupOldMemories(
        { retentionDays: 90 },
        store
      );

      expect(result.deleted).toBe(0);
      expect(result.kept).toBe(0);
    });

    it('should handle multiple memory types', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      // Create old memories of different types
      await store.add({
        type: 'session',
        content: 'Old session',
        createdAt: oldDate.toISOString(),
      });

      await store.add({
        type: 'project',
        content: 'Old project memory',
        createdAt: oldDate.toISOString(),
      });

      await store.add({
        type: 'knowledge',
        content: 'Old knowledge',
        createdAt: oldDate.toISOString(),
      });

      // Cleanup
      const result = await cleanupOldMemories(
        { retentionDays: 90 },
        store
      );

      expect(result.deleted).toBe(3);
      expect(result.kept).toBe(0);
    });

    it('should validate retention days', async () => {
      await expect(
        cleanupOldMemories({ retentionDays: 0 }, store)
      ).rejects.toThrow('Retention days must be positive');

      await expect(
        cleanupOldMemories({ retentionDays: -10 }, store)
      ).rejects.toThrow('Retention days must be positive');
    });
  });

  describe('getDefaultRetentionDays', () => {
    it('should return default value of 90 days', () => {
      delete process.env.WORKBENCH_MEMORY_RETENTION_DAYS;
      expect(getDefaultRetentionDays()).toBe(90);
    });

    it('should read from environment variable', () => {
      process.env.WORKBENCH_MEMORY_RETENTION_DAYS = '30';
      expect(getDefaultRetentionDays()).toBe(30);
      delete process.env.WORKBENCH_MEMORY_RETENTION_DAYS;
    });

    it('should fallback to default on invalid env value', () => {
      process.env.WORKBENCH_MEMORY_RETENTION_DAYS = 'invalid';
      expect(getDefaultRetentionDays()).toBe(90);
      delete process.env.WORKBENCH_MEMORY_RETENTION_DAYS;
    });
  });
});
