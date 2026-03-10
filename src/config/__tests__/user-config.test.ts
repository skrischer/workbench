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
  let configPath: string;

  beforeEach(async () => {
    // Create temp directory for each test
    tempDir = await mkdtemp(join(tmpdir(), 'user-config-test-'));
    configPath = join(tempDir, 'user-config.json');
  });

  afterEach(async () => {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('loadUserConfig', () => {
    it('should return defaults when file does not exist', async () => {
      const config = await loadUserConfig(configPath);
      
      expect(config).toEqual(DEFAULT_USER_CONFIG);
    });

    it('should create file with defaults when it does not exist', async () => {
      await loadUserConfig(configPath);
      
      // Load again and verify defaults were written
      const config = await loadUserConfig(configPath);
      expect(config).toEqual(DEFAULT_USER_CONFIG);
    });

    it('should load existing config and merge with defaults', async () => {
      // Create config with partial settings
      const partialConfig: UserConfig = {
        autoSummarize: false,
      };
      await saveUserConfig(partialConfig, configPath);
      
      // Load and verify merge
      const loaded = await loadUserConfig(configPath);
      expect(loaded.autoSummarize).toBe(false);
      expect(loaded.minMessagesForSummary).toBe(DEFAULT_USER_CONFIG.minMessagesForSummary);
    });

    it('should override defaults with user settings', async () => {
      const customConfig: UserConfig = {
        autoSummarize: false,
        minMessagesForSummary: 10,
      };
      await saveUserConfig(customConfig, configPath);
      
      const loaded = await loadUserConfig(configPath);
      expect(loaded).toEqual({
        autoSummarize: false,
        minMessagesForSummary: 10,
      });
    });

    it('should throw error on invalid JSON', async () => {
      // Write invalid JSON
      const fs = await import('node:fs/promises');
      await fs.writeFile(configPath, 'invalid json{', 'utf-8');
      
      await expect(loadUserConfig(configPath)).rejects.toThrow();
    });
  });

  describe('saveUserConfig', () => {
    it('should save config to file', async () => {
      const config: UserConfig = {
        autoSummarize: false,
        minMessagesForSummary: 5,
      };
      
      await saveUserConfig(config, configPath);
      
      // Verify by loading
      const loaded = await loadUserConfig(configPath);
      expect(loaded.autoSummarize).toBe(false);
      expect(loaded.minMessagesForSummary).toBe(5);
    });

    it('should create directory if it does not exist', async () => {
      const nestedPath = join(tempDir, 'nested', 'user-config.json');
      const config: UserConfig = { autoSummarize: true };
      
      await saveUserConfig(config, nestedPath);
      
      // Verify by loading
      const loaded = await loadUserConfig(nestedPath);
      expect(loaded.autoSummarize).toBe(true);
    });

    it('should overwrite existing file', async () => {
      // Save initial config
      await saveUserConfig({ autoSummarize: true }, configPath);
      
      // Overwrite with new config
      await saveUserConfig({ autoSummarize: false }, configPath);
      
      // Verify overwrite
      const loaded = await loadUserConfig(configPath);
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
