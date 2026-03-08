import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createMockAnthropicServer, type MockAnthropicServer } from '../mock-anthropic-server.js';
import { createTestEnv, type TestEnv } from '../test-env.js';
import { runCli } from '../cli-runner.js';
import { simpleText, toolUseReadFile, error401, error429 } from '../__fixtures__/index.js';

describe('E2E - workbench run command', () => {
  describe('1. Happy Path — Text Response', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      mockServer = await createMockAnthropicServer([
        { response: simpleText },
      ]);

      testEnv = await createTestEnv({
        anthropicApiUrl: `${mockServer.url}/v1/messages`,
      });
    });

    afterAll(async () => {
      await mockServer?.close();
      await testEnv?.cleanup();
    });

    it('should run command with simple text response', async () => {
      const result = await runCli({
        args: ['run', 'say hi'],
        env: testEnv.env,
        timeout: 15000,
      });

      // Should exit cleanly
      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);

      // Should contact mock server exactly once
      expect(mockServer.calls.length).toBe(1);

      // Should contain LLM response text in stdout
      expect(result.stdout).toContain('Hello! How can I help you today?');
    });
  });

  describe('2. Tool Use Path', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      // Mock returns toolUseReadFile first, then simpleText on second call
      mockServer = await createMockAnthropicServer([
        { response: toolUseReadFile },
        { response: simpleText },
      ]);

      testEnv = await createTestEnv({
        anthropicApiUrl: `${mockServer.url}/v1/messages`,
      });

      // Create a test file that read_file can find
      // The workbench home is our cwd for the CLI, so create file relative to that
      const testFilePath = path.join(testEnv.workbenchHome, 'test-file.txt');
      await writeFile(testFilePath, 'This is test file content', 'utf-8');
    });

    afterAll(async () => {
      await mockServer?.close();
      await testEnv?.cleanup();
    });

    it('should handle tool use and continue to completion', async () => {
      const result = await runCli({
        args: ['run', 'read the file'],
        env: testEnv.env,
        timeout: 15000,
      });

      // Should exit cleanly
      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);

      // Should contact mock server twice (tool_use + final response)
      expect(mockServer.calls.length).toBe(2);

      // Should contain final response text
      expect(result.stdout).toContain('Hello! How can I help you today?');
    });
  });

  describe('3. Error: No Token File', () => {
    let testEnv: TestEnv;

    beforeAll(async () => {
      // Create test env WITHOUT tokens (empty object)
      testEnv = await createTestEnv({
        tokens: {},
      });
    });

    afterAll(async () => {
      await testEnv?.cleanup();
    });

    it('should show helpful error when tokens are missing', async () => {
      const result = await runCli({
        args: ['run', 'test'],
        env: testEnv.env,
        timeout: 10000,
      });

      // Should fail
      expect(result.timedOut).toBe(false);
      expect(result.exitCode).not.toBe(0);

      // Should contain helpful error about tokens
      const output = result.stderr + result.stdout;
      expect(output).toMatch(/[Tt]oken/);
    });
  });

  describe('4. Error: LLM 401', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      mockServer = await createMockAnthropicServer([
        { response: error401, status: 401 },
      ]);

      testEnv = await createTestEnv({
        anthropicApiUrl: `${mockServer.url}/v1/messages`,
      });
    });

    afterAll(async () => {
      await mockServer?.close();
      await testEnv?.cleanup();
    });

    it('should handle 401 error without crashing', async () => {
      const result = await runCli({
        args: ['run', 'test'],
        env: testEnv.env,
        timeout: 10000,
      });

      // Should not timeout/crash
      expect(result.timedOut).toBe(false);

      // Should fail with non-zero exit code
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('5. Error: LLM 429', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      mockServer = await createMockAnthropicServer([
        { response: error429, status: 429 },
      ]);

      testEnv = await createTestEnv({
        anthropicApiUrl: `${mockServer.url}/v1/messages`,
      });
    });

    afterAll(async () => {
      await mockServer?.close();
      await testEnv?.cleanup();
    });

    it('should handle 429 rate limit without crashing', async () => {
      const result = await runCli({
        args: ['run', 'test'],
        env: testEnv.env,
        timeout: 10000,
      });

      // Should not timeout/crash
      expect(result.timedOut).toBe(false);

      // Should fail with non-zero exit code
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe('6. CLI Flags', () => {
    describe('--model flag', () => {
      let mockServer: MockAnthropicServer;
      let testEnv: TestEnv;

      beforeAll(async () => {
        mockServer = await createMockAnthropicServer([
          { response: simpleText },
        ]);

        testEnv = await createTestEnv({
          anthropicApiUrl: `${mockServer.url}/v1/messages`,
        });
      });

      afterAll(async () => {
        await mockServer?.close();
        await testEnv?.cleanup();
      });

      it('should use custom model from --model flag', async () => {
        const result = await runCli({
          args: ['run', '--model', 'custom-model', 'test'],
          env: testEnv.env,
          timeout: 15000,
        });

        // Should exit cleanly
        expect(result.timedOut).toBe(false);
        expect(result.exitCode).toBe(0);

        // Should have called mock server
        expect(mockServer.calls.length).toBeGreaterThanOrEqual(1);

        // Verify model in request
        const firstCall = mockServer.calls[0];
        expect(firstCall.body.model).toBe('custom-model');
      });
    });

    describe('--max-steps flag', () => {
      let mockServer: MockAnthropicServer;
      let testEnv: TestEnv;

      beforeAll(async () => {
        // Mock returns tool_use, but agent should stop after 1 step
        mockServer = await createMockAnthropicServer([
          { response: toolUseReadFile },
          { response: simpleText }, // Should not be reached
        ]);

        testEnv = await createTestEnv({
          anthropicApiUrl: `${mockServer.url}/v1/messages`,
        });

        // Create test file for tool_use
        const testFilePath = path.join(testEnv.workbenchHome, 'test-file.txt');
        await writeFile(testFilePath, 'Test content', 'utf-8');
      });

      afterAll(async () => {
        await mockServer?.close();
        await testEnv?.cleanup();
      });

      it('should respect --max-steps limit', async () => {
        const result = await runCli({
          args: ['run', '--max-steps', '1', 'test'],
          env: testEnv.env,
          timeout: 15000,
        });

        // Should stop after 1 step, status will be 'max_steps'
        expect(result.timedOut).toBe(false);
        
        // Should have called mock server only once (first step)
        expect(mockServer.calls.length).toBe(1);

        // May have non-zero exit if agent didn't complete normally
        // (depends on implementation - max_steps might be treated as failure)
      });
    });
  });
});
