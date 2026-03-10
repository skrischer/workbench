// src/memory/memory-cleanup.ts — Memory Cleanup Logic

import { LanceDBMemoryStore } from './lancedb-store.js';
import type { MemoryEntry } from '../types/memory.js';

/**
 * Result of memory cleanup operation
 */
export interface CleanupResult {
  deleted: number;
  kept: number;
}

/**
 * Options for memory cleanup
 */
export interface CleanupOptions {
  retentionDays: number;
  dryRun?: boolean;
  respectBookmarks?: boolean; // Future: respect bookmark flag
}

/**
 * Clean up old memory entries based on retention policy.
 * Deletes memories older than the specified retention period.
 * 
 * @param options - Cleanup configuration options
 * @param store - Optional LanceDB store instance (creates new if not provided)
 * @returns Cleanup result with counts of deleted and kept entries
 * 
 * @example
 * ```typescript
 * // Delete memories older than 90 days
 * const result = await cleanupOldMemories({ retentionDays: 90 });
 * console.log(`Deleted ${result.deleted}, kept ${result.kept}`);
 * 
 * // Dry run to preview what would be deleted
 * const preview = await cleanupOldMemories({ retentionDays: 90, dryRun: true });
 * console.log(`Would delete ${preview.deleted} memories`);
 * ```
 */
export async function cleanupOldMemories(
  options: CleanupOptions,
  store?: LanceDBMemoryStore
): Promise<CleanupResult> {
  const { retentionDays, dryRun = false, respectBookmarks = true } = options;

  // Validate retention period
  if (retentionDays <= 0) {
    throw new Error('Retention days must be positive');
  }

  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffIso = cutoffDate.toISOString();

  // Initialize store if not provided
  const memoryStore = store ?? new LanceDBMemoryStore();
  const shouldClose = !store; // Only close if we created it

  try {
    await memoryStore.init();

    // Get all memory entries
    // We need to fetch all types since LanceDB doesn't support OR queries easily
    const allMemories: MemoryEntry[] = [];
    const types: Array<'session' | 'project' | 'knowledge' | 'preference'> = [
      'session',
      'project',
      'knowledge',
      'preference',
    ];

    for (const type of types) {
      const entries = await memoryStore.listByType(type);
      allMemories.push(...entries);
    }

    // Filter memories to delete
    const toDelete: MemoryEntry[] = [];
    const toKeep: MemoryEntry[] = [];

    for (const memory of allMemories) {
      // Check if memory is older than cutoff
      if (memory.createdAt < cutoffIso) {
        // Future feature: Check for bookmark flag
        // For now, we prepare the structure but don't filter on it
        const isBookmarked = respectBookmarks && memory.metadata?.bookmarked === true;

        if (isBookmarked) {
          toKeep.push(memory);
        } else {
          toDelete.push(memory);
        }
      } else {
        toKeep.push(memory);
      }
    }

    // Delete old memories (unless dry run)
    if (!dryRun) {
      for (const memory of toDelete) {
        await memoryStore.delete(memory.id);
      }
    }

    return {
      deleted: toDelete.length,
      kept: toKeep.length,
    };
  } finally {
    // Close store if we created it
    if (shouldClose) {
      await memoryStore.close();
    }
  }
}

/**
 * Get retention days from environment or config.
 * Defaults to 90 days if not specified.
 */
export function getDefaultRetentionDays(): number {
  const envValue = process.env.WORKBENCH_MEMORY_RETENTION_DAYS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 90; // Default: 90 days
}
