// src/tui/__tests__/config-command.test.ts — Config Command Tests (migrated from src/cli/)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('config command', () => {
  let tempDir: string;
  let originalWorkbenchHome: string | undefined;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-test-'));
    originalWorkbenchHome = process.env.WORKBENCH_HOME;
    process.env.WORKBENCH_HOME = tempDir;
  });

  afterEach(async () => {
    if (originalWorkbenchHome === undefined) {
      delete process.env.WORKBENCH_HOME;
    } else {
      process.env.WORKBENCH_HOME = originalWorkbenchHome;
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should show default config when no config file exists', async () => {
    const { loadUserConfig, DEFAULT_USER_CONFIG } = await import('../../config/user-config.js');
    const config = await loadUserConfig();
    expect(config).toEqual(DEFAULT_USER_CONFIG);
  });

  it('should set and get config values', async () => {
    const { setConfigValue, getConfigValue } = await import('../../config/user-config.js');
    await setConfigValue('autoSummarize', false);
    const value = await getConfigValue('autoSummarize');
    expect(value).toBe(false);
  });

  it('should persist config across commands', async () => {
    const { setConfigValue, loadUserConfig } = await import('../../config/user-config.js');
    await setConfigValue('autoSummarize', false);
    await setConfigValue('memoryRetentionDays', 30);
    const config = await loadUserConfig();
    expect(config.autoSummarize).toBe(false);
    expect(config.memoryRetentionDays).toBe(30);
  });
});
