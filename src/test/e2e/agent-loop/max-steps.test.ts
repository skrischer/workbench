import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createMockAnthropicServer, type MockAnthropicServer } from '../../mock-anthropic-server.js';
import { createTestEnv, type TestEnv } from '../../test-env.js';
import { runCli } from '../../cli-runner.js';

describe('E2E Agent Loop - Max Steps Limit', () => {
  describe('Max Steps Enforcement with Infinite Tool Loop', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      // Helper to create tool_use responses that simulate infinite loop
      const toolResponse = (id: number) => ({
        id: `msg_steps_${id}`,
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: `Step ${id}` },
          {
            type: 'tool_use',
            id: `toolu_steps_${id}`,
            name: 'read_file',
            input: { path: 'test.txt' },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 20, output_tokens: 30 },
      });

      // Mock server response queue: provide 5 tool_use responses
      // With --max-steps 3, only first 3 should be consumed
      mockServer = await createMockAnthropicServer([
        { response: toolResponse(1) },
        { response: toolResponse(2) },
        { response: toolResponse(3) },
        { response: toolResponse(4) },
        { response: toolResponse(5) },
      ]);

      testEnv = await createTestEnv({
        anthropicApiUrl: `${mockServer.url}/v1/messages`,
      });

      // Create test file with content for read_file tool
      const testFilePath = path.join(testEnv.workbenchHome, 'test.txt');
      await writeFile(testFilePath, 'Test file content for infinite loop', 'utf-8');
    });

    afterAll(async () => {
      await mockServer?.close();
      await testEnv?.cleanup();
    });

    it('should stop after exactly 3 tool calls with --max-steps 3', async () => {
      const result = await runCli({
        args: ['run', 'keep reading files', '--max-steps', '3'],
        env: testEnv.env,
        cwd: testEnv.workbenchHome,
        timeout: 15000,
      });

      // Should NOT timeout or hang
      expect(result.timedOut).toBe(false);

      // Should exit cleanly
      expect(result.exitCode).toBe(0);

      // CRITICAL: Mock server should have received exactly 3 requests, not more
      expect(mockServer.calls.length).toBe(3);

      // Verify first request is a user message
      const firstCall = mockServer.calls[0];
      expect(firstCall.body.messages).toBeDefined();
      const firstMessages = firstCall.body.messages as Array<{ role: string; content: unknown }>;
      expect(firstMessages.length).toBeGreaterThanOrEqual(1);
      expect(firstMessages[0].role).toBe('user');

      // Verify subsequent calls contain tool_result
      for (let i = 1; i < mockServer.calls.length; i++) {
        const call = mockServer.calls[i];
        const messages = call.body.messages as Array<{
          role: string;
          content: Array<{ type: string }> | string;
        }>;

        // Should contain a user message with tool_result
        const userMessageWithToolResult = messages.find(
          (msg) => msg.role === 'user' && Array.isArray(msg.content)
        );
        expect(userMessageWithToolResult).toBeDefined();

        if (userMessageWithToolResult && Array.isArray(userMessageWithToolResult.content)) {
          const toolResultBlock = userMessageWithToolResult.content.find(
            (block) => block.type === 'tool_result'
          );
          expect(toolResultBlock).toBeDefined();
        }
      }
    });
  });
});
