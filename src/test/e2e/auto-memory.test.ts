// src/test/e2e/auto-memory.test.ts — E2E Test for Automatic Memory Storage

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createMockAnthropicServer, type MockAnthropicServer } from '../mock-anthropic-server.js';
import { createTestEnv, type TestEnv } from '../test-env.js';
import { runCli } from '../cli-runner.js';
import { simpleText } from '../__fixtures__/index.js';
import type { RunMetadata } from '../../types/run.js';
import { LanceDBMemoryStore } from '../../memory/lancedb-store.js';
import { loadUserConfig, saveUserConfig } from '../../config/user-config.js';

describe('E2E Auto-Memory Storage', () => {
  describe('Auto-Summarization Enabled', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      // Mock server returns multiple responses (to ensure > 3 messages)
      mockServer = await createMockAnthropicServer([
        { response: simpleText },
        { response: simpleText },
      ]);

      testEnv = await createTestEnv({
        anthropicApiUrl: `${mockServer.url}/v1/messages`,
      });

      // Enable auto-summarization in user config
      const userConfigPath = path.join(testEnv.workbenchHome, 'user-config.json');
      await saveUserConfig({
        autoSummarize: true,
        minMessagesForSummary: 2, // Lower threshold for testing
      }, userConfigPath);
    });

    afterAll(async () => {
      await mockServer?.close();
      await testEnv?.cleanup();
    });

    it('should create memory entry after successful run', async () => {
      const result = await runCli({
        args: ['run', 'Hello, this is a test run with multiple messages'],
        env: testEnv.env,
        cwd: testEnv.workbenchHome,
        timeout: 30000,
      });

      // Should complete successfully
      expect(result.timedOut).toBe(false);
      if (result.exitCode !== 0) {
        console.error('CLI failed with stderr:', result.stderr);
        console.error('CLI stdout:', result.stdout);
      }
      expect(result.exitCode).toBe(0);

      // Find the run directory (latest run)
      const runsDir = path.join(testEnv.workbenchHome, 'runs');
      const { readdir } = await import('node:fs/promises');
      const runDirs = await readdir(runsDir, { withFileTypes: true });
      const runFolders = runDirs.filter((entry) => entry.isDirectory());

      expect(runFolders.length).toBeGreaterThanOrEqual(1);

      // Read run metadata from the latest run
      const runId = runFolders[runFolders.length - 1].name;
      const runJsonPath = path.join(runsDir, runId, 'run.json');
      const runContent = await readFile(runJsonPath, 'utf-8');
      const runMetadata: RunMetadata = JSON.parse(runContent);

      // Verify memoryId was added to run metadata
      expect(runMetadata.memoryId).toBeDefined();
      expect(typeof runMetadata.memoryId).toBe('string');
      expect(runMetadata.memoryId!.length).toBeGreaterThan(0);

      // Verify memory entry exists in LanceDB
      const memoryStore = new LanceDBMemoryStore({
        dbPath: path.join(testEnv.workbenchHome, 'memory'),
      });
      await memoryStore.init();

      const memoryEntry = await memoryStore.get(runMetadata.memoryId!);
      expect(memoryEntry).toBeDefined();
      expect(memoryEntry!.type).toBe('session');
      expect(memoryEntry!.content).toBeDefined();
      expect(memoryEntry!.content.length).toBeGreaterThan(0);

      // Verify metadata contains expected fields
      expect(memoryEntry!.metadata).toMatchObject({
        sessionId: expect.any(String),
        runId,
      });
      expect(memoryEntry!.tags).toContain('session');
    });
  });

  describe('Auto-Summarization Disabled', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      mockServer = await createMockAnthropicServer([
        { response: simpleText },
      ]);

      testEnv = await createTestEnv({
        anthropicApiUrl: `${mockServer.url}/v1/messages`,
      });

      // Disable auto-summarization
      const userConfigPath = path.join(testEnv.workbenchHome, 'user-config.json');
      await saveUserConfig({
        autoSummarize: false,
      }, userConfigPath);
    });

    afterAll(async () => {
      await mockServer?.close();
      await testEnv?.cleanup();
    });

    it('should NOT create memory entry when autoSummarize is false', async () => {
      const result = await runCli({
        args: ['run', 'Test with auto-summarization disabled'],
        env: testEnv.env,
        cwd: testEnv.workbenchHome,
        timeout: 15000,
      });

      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);

      // Find the run directory
      const runsDir = path.join(testEnv.workbenchHome, 'runs');
      const { readdir } = await import('node:fs/promises');
      const runDirs = await readdir(runsDir, { withFileTypes: true });
      const runFolders = runDirs.filter((entry) => entry.isDirectory());

      expect(runFolders.length).toBeGreaterThanOrEqual(1);

      // Read run metadata
      const runId = runFolders[runFolders.length - 1].name;
      const runJsonPath = path.join(runsDir, runId, 'run.json');
      const runContent = await readFile(runJsonPath, 'utf-8');
      const runMetadata: RunMetadata = JSON.parse(runContent);

      // Verify memoryId was NOT added
      expect(runMetadata.memoryId).toBeUndefined();
    });
  });

  describe('User Config Loading', () => {
    let testEnv: TestEnv;

    beforeAll(async () => {
      testEnv = await createTestEnv();
    });

    afterAll(async () => {
      await testEnv?.cleanup();
    });

    it('should load user config with defaults', async () => {
      const userConfigPath = path.join(testEnv.workbenchHome, 'user-config.json');
      const config = await loadUserConfig(userConfigPath);

      expect(config.autoSummarize).toBe(true); // Default value
      expect(config.minMessagesForSummary).toBe(3); // Default value
    });

    it('should respect user config overrides', async () => {
      const userConfigPath = path.join(testEnv.workbenchHome, 'user-config.json');
      
      await saveUserConfig({
        autoSummarize: false,
        minMessagesForSummary: 10,
      }, userConfigPath);

      const config = await loadUserConfig(userConfigPath);
      expect(config.autoSummarize).toBe(false);
      expect(config.minMessagesForSummary).toBe(10);
    });
  });
});
