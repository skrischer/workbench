import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMockAnthropicServer, type MockAnthropicServer } from '../mock-anthropic-server.js';
import { createTestEnv, type TestEnv } from '../test-env.js';
import { runCli } from '../cli-runner.js';

describe('E2E Plan Commands', () => {
  describe('Plan Command Help', () => {
    it('workbench plan --help should show description', async () => {
      const result = await runCli({
        args: ['plan', '--help'],
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.stdout).toContain('Generate an execution plan from a prompt');
    });
  });

  describe('Plans Command Help', () => {
    it('workbench plans --help should show description', async () => {
      const result = await runCli({
        args: ['plans', '--help'],
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.stdout).toContain('List all execution plans');
    });
  });

  describe('Run-Plan Command Help', () => {
    it('workbench run-plan --help should show description', async () => {
      const result = await runCli({
        args: ['run-plan', '--help'],
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.stdout).toContain('Execute a plan by ID');
    });
  });

  describe('Plan Creation and Listing', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      // Create mock response with a valid plan JSON
      const planResponse = {
        id: 'msg_plan_001',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              title: 'Create a Simple Server',
              description: 'Build a basic HTTP server with Node.js',
              steps: [
                {
                  id: 'step-1',
                  title: 'Create server file',
                  prompt: 'Create a file called server.js with a basic HTTP server',
                  status: 'pending',
                  maxSteps: 5,
                },
                {
                  id: 'step-2',
                  title: 'Add request handler',
                  prompt: 'Add a request handler that responds with "Hello World"',
                  status: 'pending',
                  dependsOn: ['step-1'],
                  maxSteps: 3,
                },
                {
                  id: 'step-3',
                  title: 'Add port configuration',
                  prompt: 'Make the port configurable via environment variable',
                  status: 'pending',
                  dependsOn: ['step-2'],
                  maxSteps: 2,
                },
              ],
            }),
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 50,
          output_tokens: 200,
        },
      };

      mockServer = await createMockAnthropicServer([
        { response: planResponse },
      ]);

      testEnv = await createTestEnv({
        anthropicApiUrl: `${mockServer.url}/v1/messages`,
      });
    });

    afterAll(async () => {
      await mockServer?.close();
      await testEnv?.cleanup();
    });

    it('should create a plan from user prompt', async () => {
      const result = await runCli({
        args: ['plan', 'create a server'],
        env: testEnv.env,
        timeout: 15000,
      });

      // Should contact mock server
      expect(mockServer.calls.length).toBeGreaterThanOrEqual(1);

      // Should exit cleanly
      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);

      // Should contain plan details
      expect(result.stdout).toContain('Create a Simple Server');
      expect(result.stdout).toContain('Build a basic HTTP server');
      expect(result.stdout).toContain('Create server file');
      expect(result.stdout).toContain('Plan ID:');
      expect(result.stdout).toContain('Total Steps: 3');

      // Should show next step instructions
      expect(result.stderr).toContain('Plan generated and saved');
      expect(result.stderr).toContain('Run with: workbench run-plan');
    });

    it('should list created plans', async () => {
      const result = await runCli({
        args: ['plans'],
        env: testEnv.env,
        timeout: 10000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);

      // Should show the plan we just created
      expect(result.stdout).toContain('Plans (1)');
      expect(result.stdout).toContain('Create a Simple Server');
      expect(result.stdout).toContain('pending');
      expect(result.stdout).toContain('3'); // step count
    });
  });

  describe('Plans Command - Empty State', () => {
    let testEnv: TestEnv;

    beforeAll(async () => {
      testEnv = await createTestEnv();
    });

    afterAll(async () => {
      await testEnv?.cleanup();
    });

    it('should handle empty plan list gracefully', async () => {
      const result = await runCli({
        args: ['plans'],
        env: testEnv.env,
        timeout: 10000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.stdout).toContain('No plans found');
    });
  });

  describe('Run-Plan Error Handling', () => {
    let testEnv: TestEnv;

    beforeAll(async () => {
      testEnv = await createTestEnv();
    });

    afterAll(async () => {
      await testEnv?.cleanup();
    });

    it('should fail with non-existent plan ID', async () => {
      const result = await runCli({
        args: ['run-plan', 'nonexistent-plan-id-12345'],
        env: testEnv.env,
        timeout: 10000,
      });

      // Should fail
      expect(result.exitCode).not.toBe(0);
      expect(result.timedOut).toBe(false);

      // Should show error message
      const output = result.stderr + result.stdout;
      expect(output.toLowerCase()).toMatch(/failed|error|not found/);
    });
  });
});
