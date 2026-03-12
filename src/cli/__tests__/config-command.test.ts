// src/cli/__tests__/config-command.test.ts — E2E tests for config command

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

describe('config command (E2E)', () => {
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

  it('should show default config when no config file exists', async () => {
    // Note: This test assumes the CLI is built and available
    // In a real E2E test, you'd run: workbench config
    // For now, we test the underlying functions directly
    const { loadUserConfig, DEFAULT_USER_CONFIG } = await import('../../config/user-config.js');
    const config = await loadUserConfig();

    expect(config).toEqual(DEFAULT_USER_CONFIG);
  });

  it('should set and get config values', async () => {
    const { setConfigValue, getConfigValue } = await import('../../config/user-config.js');

    // Set autoSummarize to false
    await setConfigValue('autoSummarize', false);

    // Get the value
    const value = await getConfigValue('autoSummarize');
    expect(value).toBe(false);
  });

  it('should persist config across commands', async () => {
    const { setConfigValue, loadUserConfig } = await import('../../config/user-config.js');

    // Set multiple values
    await setConfigValue('autoSummarize', false);
    await setConfigValue('memoryRetentionDays', 30);

    // Load config
    const config = await loadUserConfig();
    expect(config.autoSummarize).toBe(false);
    expect(config.memoryRetentionDays).toBe(30);
  });
});
