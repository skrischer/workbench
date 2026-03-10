// src/cli/__tests__/cleanup-command.test.ts — Cleanup Command Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCleanupCommand } from '../cleanup-command.js';
import * as memoryCleanup from '../../memory/memory-cleanup.js';

// Mock memory cleanup functions
vi.mock('../../memory/memory-cleanup.js', async () => {
  const actual = await vi.importActual('../../memory/memory-cleanup.js');
  return {
    ...actual,
    cleanupOldMemories: vi.fn(),
    getDefaultRetentionDays: vi.fn(() => 90),
  };
});

describe('Cleanup Command', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`Process exit: ${code}`);
    }) as any);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('command structure', () => {
    it('should create cleanup command with correct name', () => {
      const command = createCleanupCommand();
      expect(command.name()).toBe('cleanup');
    });

    it('should have correct description', () => {
      const command = createCleanupCommand();
      expect(command.description()).toContain('Clean up old data');
    });

    it('should have required options', () => {
      const command = createCleanupCommand();
      const options = command.options.map((opt) => opt.long);
      
      expect(options).toContain('--memories');
      expect(options).toContain('--older-than');
      expect(options).toContain('--dry-run');
    });
  });

  describe('cleanup execution', () => {
    it('should clean up memories with custom retention', async () => {
      const mockCleanup = vi.mocked(memoryCleanup.cleanupOldMemories);
      mockCleanup.mockResolvedValue({ deleted: 5, kept: 10 });

      const command = createCleanupCommand();
      await command.parseAsync(['node', 'test', '--memories', '--older-than', '30d']);

      expect(mockCleanup).toHaveBeenCalledWith(
        expect.objectContaining({
          retentionDays: 30,
          dryRun: false,
        })
      );
    });

    it('should use default retention when not specified', async () => {
      const mockCleanup = vi.mocked(memoryCleanup.cleanupOldMemories);
      mockCleanup.mockResolvedValue({ deleted: 3, kept: 7 });

      const command = createCleanupCommand();
      await command.parseAsync(['node', 'test', '--memories']);

      expect(mockCleanup).toHaveBeenCalledWith(
        expect.objectContaining({
          retentionDays: 90,
        })
      );
    });

    it('should perform dry run when flag is set', async () => {
      const mockCleanup = vi.mocked(memoryCleanup.cleanupOldMemories);
      mockCleanup.mockResolvedValue({ deleted: 5, kept: 10 });

      const command = createCleanupCommand();
      await command.parseAsync(['node', 'test', '--memories', '--dry-run']);

      expect(mockCleanup).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: true,
        })
      );
    });

    it('should display results after cleanup', async () => {
      const mockCleanup = vi.mocked(memoryCleanup.cleanupOldMemories);
      mockCleanup.mockResolvedValue({ deleted: 5, kept: 10 });

      const command = createCleanupCommand();
      await command.parseAsync(['node', 'test', '--memories', '--older-than', '90d']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Deleted: 5 memories')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Kept: 10 memories')
      );
    });

    it('should show dry run message', async () => {
      const mockCleanup = vi.mocked(memoryCleanup.cleanupOldMemories);
      mockCleanup.mockResolvedValue({ deleted: 5, kept: 10 });

      const command = createCleanupCommand();
      await command.parseAsync(['node', 'test', '--memories', '--dry-run']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('DRY RUN MODE')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Would delete: 5 memories')
      );
    });
  });

  describe('error handling', () => {
    it('should require at least one cleanup target', async () => {
      const command = createCleanupCommand();
      
      await expect(async () => {
        await command.parseAsync(['node', 'test']);
      }).rejects.toThrow('Process exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Please specify what to clean up')
      );
    });

    it('should validate duration format', async () => {
      const command = createCleanupCommand();
      
      await expect(async () => {
        await command.parseAsync(['node', 'test', '--memories', '--older-than', 'invalid']);
      }).rejects.toThrow();
    });

    it('should handle cleanup errors gracefully', async () => {
      const mockCleanup = vi.mocked(memoryCleanup.cleanupOldMemories);
      mockCleanup.mockRejectedValue(new Error('Database error'));

      const command = createCleanupCommand();
      
      await expect(async () => {
        await command.parseAsync(['node', 'test', '--memories']);
      }).rejects.toThrow('Process exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup failed'),
        expect.stringContaining('Database error')
      );
    });
  });

  describe('duration parsing', () => {
    it('should parse valid duration strings', async () => {
      const mockCleanup = vi.mocked(memoryCleanup.cleanupOldMemories);
      mockCleanup.mockResolvedValue({ deleted: 0, kept: 0 });

      const command = createCleanupCommand();

      // Test different valid formats
      await command.parseAsync(['node', 'test', '--memories', '--older-than', '1d']);
      expect(mockCleanup).toHaveBeenLastCalledWith(
        expect.objectContaining({ retentionDays: 1 })
      );

      await command.parseAsync(['node', 'test', '--memories', '--older-than', '365d']);
      expect(mockCleanup).toHaveBeenLastCalledWith(
        expect.objectContaining({ retentionDays: 365 })
      );
    });

    it('should reject invalid duration formats', async () => {
      const command = createCleanupCommand();
      
      const invalidFormats = ['90', '90days', 'd90', '90m', 'abc'];
      
      for (const format of invalidFormats) {
        await expect(async () => {
          await command.parseAsync(['node', 'test', '--memories', '--older-than', format]);
        }).rejects.toThrow();
      }
    });
  });
});
