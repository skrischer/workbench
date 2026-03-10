// src/config/__tests__/user-config.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadUserConfig,
  saveUserConfig,
  DEFAULT_USER_CONFIG,
  type UserConfig,
} from '../user-config.js';

describe('user-config', () => {
  let tempDir: string;
  let originalWorkbenchHome: string | undefined;

  beforeEach(async () => {
    // Create temp directory for each test
    tempDir = await mkdtemp(join(tmpdir(), 'user-config-test-'));
    
    // Save original WORKBENCH_HOME and set to temp dir
    originalWorkbenchHome = process.env.WORKBENCH_HOME;
    process.env.WORKBENCH_HOME = tempDir;
  });

  afterEach(async () => {
    // Restore original WORKBENCH_HOME
    if (originalWorkbenchHome !== undefined) {
      process.env.WORKBENCH_HOME = originalWorkbenchHome;
    } else {
      delete process.env.WORKBENCH_HOME;
    }
    
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('loadUserConfig', () => {
    it('should return defaults when file does not exist', async () => {
      const config = await loadUserConfig();
      
      expect(config).toEqual(DEFAULT_USER_CONFIG);
    });

    it('should create file with defaults when it does not exist', async () => {
      await loadUserConfig();
      
      // Load again and verify defaults were written
      const config = await loadUserConfig();
      expect(config).toEqual(DEFAULT_USER_CONFIG);
    });

    it('should load existing config and merge with defaults', async () => {
      // Create config with partial settings
      const partialConfig: UserConfig = {
        autoSummarize: false,
      };
      await saveUserConfig(partialConfig);
      
      // Load and verify merge
      const loaded = await loadUserConfig();
      expect(loaded.autoSummarize).toBe(false);
      expect(loaded.minMessagesForSummary).toBe(DEFAULT_USER_CONFIG.minMessagesForSummary);
    });

    it('should override defaults with user settings', async () => {
      const customConfig: UserConfig = {
        autoSummarize: false,
        minMessagesForSummary: 10,
      };
      await saveUserConfig(customConfig);
      
      const loaded = await loadUserConfig();
      expect(loaded).toEqual({
        autoSummarize: false,
        minMessagesForSummary: 10,
        summarizerModel: DEFAULT_USER_CONFIG.summarizerModel,
        memoryRetentionDays: DEFAULT_USER_CONFIG.memoryRetentionDays,
      });
    });

    it('should throw error on invalid JSON', async () => {
      // Write invalid JSON to the expected config path
      const fs = await import('node:fs/promises');
      const configPath = join(tempDir, 'config.json');
      await fs.writeFile(configPath, 'invalid json{', 'utf-8');
      
      await expect(loadUserConfig()).rejects.toThrow();
    });
  });

  describe('saveUserConfig', () => {
    it('should save config to file', async () => {
      const config: UserConfig = {
        autoSummarize: false,
        minMessagesForSummary: 5,
      };
      
      await saveUserConfig(config);
      
      // Verify by loading
      const loaded = await loadUserConfig();
      expect(loaded.autoSummarize).toBe(false);
      expect(loaded.minMessagesForSummary).toBe(5);
    });

    it('should create directory if it does not exist', async () => {
      // Set WORKBENCH_HOME to nested path
      const nestedDir = join(tempDir, 'nested');
      process.env.WORKBENCH_HOME = nestedDir;
      
      const config: UserConfig = { autoSummarize: true };
      
      await saveUserConfig(config);
      
      // Verify by loading
      const loaded = await loadUserConfig();
      expect(loaded.autoSummarize).toBe(true);
    });

    it('should overwrite existing file', async () => {
      // Save initial config
      await saveUserConfig({ autoSummarize: true });
      
      // Overwrite with new config
      await saveUserConfig({ autoSummarize: false });
      
      // Verify overwrite
      const loaded = await loadUserConfig();
      expect(loaded.autoSummarize).toBe(false);
    });
  });

  describe('DEFAULT_USER_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_USER_CONFIG.autoSummarize).toBe(true);
      expect(DEFAULT_USER_CONFIG.minMessagesForSummary).toBe(3);
    });
  });
});
