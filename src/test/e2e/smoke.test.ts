import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMockAnthropicServer, type MockAnthropicServer } from '../mock-anthropic-server.js';
import { createTestEnv, type TestEnv } from '../test-env.js';
import { runCli } from '../cli-runner.js';
import { simpleText, error401, error429 } from '../__fixtures__/index.js';

describe('E2E Smoke Test', () => {
  describe('Basic Smoke - Happy Path', () => {
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

    it('should run workbench with mock server and get response', async () => {
      const result = await runCli({
        args: ['run', 'say hi'],
        env: testEnv.env,
        timeout: 15000,
      });

      // Should contact mock server
      expect(mockServer.calls.length).toBeGreaterThanOrEqual(1);
      
      // Should exit cleanly
      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);

      // Should contain LLM response text
      expect(result.stdout).toContain('Hello! How can I help you today?');
    });

    it('should use Authorization Bearer header, not x-api-key', async () => {
      const result = await runCli({
        args: ['run', 'test auth'],
        env: testEnv.env,
        timeout: 15000,
      });

      expect(result.timedOut).toBe(false);
      expect(mockServer.calls.length).toBeGreaterThanOrEqual(1);

      const firstCall = mockServer.calls[0];
      const authHeader = firstCall.headers['authorization'];

      // Must use Authorization: Bearer
      expect(authHeader).toBeDefined();
      expect(authHeader).toMatch(/^Bearer sk-ant-/);

      // Must NOT use x-api-key
      expect(firstCall.headers['x-api-key']).toBeUndefined();
    });
  });

  describe('CLI Help', () => {
    it('workbench --help should show available commands', async () => {
      const result = await runCli({
        args: ['--help'],
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.stdout).toContain('run');
      expect(result.stdout).toContain('plan');
      expect(result.stdout).toContain('dashboard');
    });

    it('workbench run --help should show run options', async () => {
      const result = await runCli({
        args: ['run', '--help'],
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      // Should contain option descriptions
      expect(result.stdout.length).toBeGreaterThan(50);
    });
  });

  describe('Missing Tokens Error', () => {
    let testEnv: TestEnv;

    beforeAll(async () => {
      // Create env WITHOUT tokens (pass empty object)
      testEnv = await createTestEnv({
        tokens: {},
      });
    });

    afterAll(async () => {
      await testEnv?.cleanup();
    });

    it('should show helpful error when tokens.json is missing/empty', async () => {
      const result = await runCli({
        args: ['run', 'test'],
        env: testEnv.env,
        timeout: 10000,
      });

      // Should fail
      expect(result.exitCode).not.toBe(0);

      // Should contain helpful error about tokens
      const output = result.stderr + result.stdout;
      expect(output.toLowerCase()).toMatch(/token|auth|credential/);
    });
  });

  describe('LLM Error Handling', () => {
    describe('401 Unauthorized', () => {
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

      it('should handle 401 error gracefully', async () => {
        const result = await runCli({
          args: ['run', 'test'],
          env: testEnv.env,
          timeout: 10000,
        });

        // Should not timeout/crash
        expect(result.timedOut).toBe(false);

        // Should show auth error
        const output = result.stderr + result.stdout;
        expect(output.toLowerCase()).toMatch(/auth|unauthorized|invalid.*key|credential/);
      });
    });

    describe('429 Rate Limit', () => {
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

      it('should handle 429 rate limit gracefully', async () => {
        const result = await runCli({
          args: ['run', 'test'],
          env: testEnv.env,
          timeout: 10000,
        });

        // Should not timeout/crash
        expect(result.timedOut).toBe(false);

        // Should show rate limit message
        const output = result.stderr + result.stdout;
        expect(output.toLowerCase()).toMatch(/rate.*limit|too.*many.*request|429/);
      });
    });
  });
});
