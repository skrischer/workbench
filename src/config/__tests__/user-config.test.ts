// src/config/__tests__/user-config.test.ts — Unit tests for UserConfig

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  loadUserConfig,
  saveUserConfig,
  getConfigValue,
  setConfigValue,
  DEFAULT_USER_CONFIG,
  type UserConfig,
} from '../user-config.js';

describe('UserConfig', () => {
  let tempDir: string;
  let originalWorkbenchHome: string | undefined;

  beforeEach(async () => {
    // Create temp directory for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-test-'));
    originalWorkbenchHome = process.env.WORKBENCH_HOME;
    process.env.WORKBENCH_HOME = tempDir;
  });

  afterEach(async () => {
    // Restore env var
    if (originalWorkbenchHome === undefined) {
      delete process.env.WORKBENCH_HOME;
    } else {
      process.env.WORKBENCH_HOME = originalWorkbenchHome;
    }

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadUserConfig', () => {
    it('should return defaults when config file does not exist', async () => {
      const config = await loadUserConfig();
      expect(config).toEqual(DEFAULT_USER_CONFIG);
    });

    it('should load config from file', async () => {
      const customConfig: UserConfig = {
        autoSummarize: false,
        summarizerModel: 'anthropic/claude-sonnet-4',
        memoryRetentionDays: 30,
      };

      const configPath = path.join(tempDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(customConfig, null, 2));

      const config = await loadUserConfig();
      expect(config).toEqual(customConfig);
    });

    it('should merge partial config with defaults', async () => {
      const partialConfig: Partial<UserConfig> = {
        autoSummarize: false,
      };

      const configPath = path.join(tempDir, 'config.json');
      await fs.writeFile(configPath, JSON.stringify(partialConfig, null, 2));

      const config = await loadUserConfig();
      expect(config).toEqual({
        autoSummarize: false,
        summarizerModel: DEFAULT_USER_CONFIG.summarizerModel,
        memoryRetentionDays: DEFAULT_USER_CONFIG.memoryRetentionDays,
      });
    });

    it('should throw on invalid JSON', async () => {
      const configPath = path.join(tempDir, 'config.json');
      await fs.writeFile(configPath, 'invalid json');

      await expect(loadUserConfig()).rejects.toThrow('Failed to load user config');
    });
  });

  describe('saveUserConfig', () => {
    it('should create config file if it does not exist', async () => {
      const config: UserConfig = {
        autoSummarize: false,
        summarizerModel: 'anthropic/claude-opus-4',
        memoryRetentionDays: 60,
      };

      await saveUserConfig(config);

      const configPath = path.join(tempDir, 'config.json');
      const content = await fs.readFile(configPath, 'utf-8');
      const savedConfig = JSON.parse(content);

      expect(savedConfig).toEqual(config);
    });

    it('should merge partial updates with existing config', async () => {
      // Save initial config
      await saveUserConfig({ autoSummarize: false });

      // Update only one field
      await saveUserConfig({ memoryRetentionDays: 30 });

      const config = await loadUserConfig();
      expect(config).toEqual({
        autoSummarize: false,
        summarizerModel: DEFAULT_USER_CONFIG.summarizerModel,
        memoryRetentionDays: 30,
      });
    });

    it('should create directory if it does not exist', async () => {
      const nestedDir = path.join(tempDir, 'nested', 'path');
      process.env.WORKBENCH_HOME = nestedDir;

      await saveUserConfig({ autoSummarize: true });

      const configPath = path.join(nestedDir, 'config.json');
      const exists = await fs.stat(configPath).then(
        () => true,
        () => false
      );
      expect(exists).toBe(true);
    });
  });

  describe('getConfigValue', () => {
    it('should return default value when config file does not exist', async () => {
      const value = await getConfigValue('autoSummarize');
      expect(value).toBe(DEFAULT_USER_CONFIG.autoSummarize);
    });

    it('should return custom value from config file', async () => {
      await saveUserConfig({ autoSummarize: false });

      const value = await getConfigValue('autoSummarize');
      expect(value).toBe(false);
    });
  });

  describe('setConfigValue', () => {
    it('should set a single config value', async () => {
      await setConfigValue('autoSummarize', false);

      const config = await loadUserConfig();
      expect(config.autoSummarize).toBe(false);
      expect(config.summarizerModel).toBe(DEFAULT_USER_CONFIG.summarizerModel);
      expect(config.memoryRetentionDays).toBe(DEFAULT_USER_CONFIG.memoryRetentionDays);
    });

    it('should preserve other values when updating', async () => {
      await saveUserConfig({ autoSummarize: false, memoryRetentionDays: 30 });
      await setConfigValue('summarizerModel', 'anthropic/claude-opus-4');

      const config = await loadUserConfig();
      expect(config).toEqual({
        autoSummarize: false,
        summarizerModel: 'anthropic/claude-opus-4',
        memoryRetentionDays: 30,
      });
    });
  });

  describe('DEFAULT_USER_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_USER_CONFIG).toEqual({
        autoSummarize: true,
        summarizerModel: 'anthropic/claude-haiku-4',
        memoryRetentionDays: 90,
      });
    });
  });
});
