// src/cli/cleanup-command.ts — Cleanup Command Implementation

import { Command } from 'commander';
import { cleanupOldMemories, getDefaultRetentionDays } from '../memory/memory-cleanup.js';

/**
 * Parse duration string (e.g., "90d", "30d") to days.
 * @param duration - Duration string with 'd' suffix
 * @returns Number of days
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)d$/);
  if (!match) {
    throw new Error('Invalid duration format. Use format like "90d" (90 days)');
  }
  return parseInt(match[1], 10);
}

/**
 * Creates the cleanup command for managing old data.
 */
export function createCleanupCommand(): Command {
  const cleanup = new Command('cleanup')
    .description('Clean up old data (memories, sessions, etc.)')
    .option('--memories', 'Clean up old memory entries')
    .option('--older-than <duration>', 'Delete entries older than this duration (e.g., "90d")')
    .option('--dry-run', 'Show what would be deleted without actually deleting')
    .action(async (options: { memories?: boolean; olderThan?: string; dryRun?: boolean }) => {
      try {
        // Validate that at least one cleanup target is specified
        if (!options.memories) {
          console.error('❌ Error: Please specify what to clean up (e.g., --memories)');
          console.log('\nExample: workbench cleanup --memories --older-than 90d');
          process.exit(1);
        }

        // Determine retention period
        let retentionDays: number;
        if (options.olderThan) {
          retentionDays = parseDuration(options.olderThan);
        } else {
          retentionDays = getDefaultRetentionDays();
          console.log(`ℹ️  Using default retention: ${retentionDays} days`);
        }

        // Memory cleanup
        if (options.memories) {
          console.log(`\n🧹 Cleaning up memories older than ${retentionDays} days...`);
          if (options.dryRun) {
            console.log('📋 DRY RUN MODE: No data will be deleted\n');
          }

          const result = await cleanupOldMemories({
            retentionDays,
            dryRun: options.dryRun ?? false,
          });

          // Display results
          console.log('\n📊 Cleanup Results:');
          console.log(`   ${options.dryRun ? 'Would delete' : 'Deleted'}: ${result.deleted} memories`);
          console.log(`   Kept: ${result.kept} memories`);

          if (options.dryRun && result.deleted > 0) {
            console.log('\n💡 Tip: Remove --dry-run to actually delete these memories');
          } else if (!options.dryRun && result.deleted > 0) {
            console.log('\n✅ Cleanup completed successfully');
          } else if (result.deleted === 0) {
            console.log('\n✨ No memories to clean up');
          }
        }
      } catch (error) {
        console.error('\n❌ Cleanup failed:', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return cleanup;
}
