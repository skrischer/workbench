import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createMockAnthropicServer, type MockAnthropicServer } from '../../mock-anthropic-server.js';
import { createTestEnv, type TestEnv } from '../../test-env.js';
import { runCli } from '../../cli-runner.js';
import { simpleText, toolUseReadFile } from '../../__fixtures__/index.js';

describe('E2E Agent Loop - Single Tool Use', () => {
  describe('Complete Single-Turn Tool-Use Cycle', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      // Mock server response queue:
      // 1. tool_use for read_file
      // 2. final text response
      mockServer = await createMockAnthropicServer([
        { response: toolUseReadFile },
        { response: simpleText },
      ]);

      testEnv = await createTestEnv({
        anthropicApiUrl: `${mockServer.url}/v1/messages`,
      });

      // Create test file with expected content
      const testFilePath = path.join(testEnv.workbenchHome, 'test-file.txt');
      await writeFile(testFilePath, 'Hello from test file', 'utf-8');
    });

    afterAll(async () => {
      await mockServer?.close();
      await testEnv?.cleanup();
    });

    it('should complete tool_use → tool_result → final text cycle', async () => {
      const result = await runCli({
        args: ['run', 'read the test file'],
        env: testEnv.env,
        cwd: testEnv.workbenchHome,
        timeout: 15000,
      });

      // Should exit cleanly
      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);

      // Should contact mock server exactly 2 times
      expect(mockServer.calls.length).toBe(2);

      // First request: user message
      const firstCall = mockServer.calls[0];
      expect(firstCall.body.messages).toBeDefined();
      const firstMessages = firstCall.body.messages as Array<{ role: string; content: unknown }>;
      expect(firstMessages.length).toBeGreaterThanOrEqual(1);
      expect(firstMessages[0].role).toBe('user');

      // Second request: contains tool_result with file contents
      const secondCall = mockServer.calls[1];
      expect(secondCall.body.messages).toBeDefined();
      const secondMessages = secondCall.body.messages as Array<{
        role: string;
        content: Array<{ type: string; content?: string; tool_use_id?: string }> | string;
      }>;

      // Find the user message with tool_result
      const userMessageWithToolResult = secondMessages.find(
        (msg) => msg.role === 'user' && Array.isArray(msg.content)
      );
      expect(userMessageWithToolResult).toBeDefined();

      // Verify tool_result exists and contains file contents
      const toolResultBlock = (userMessageWithToolResult!.content as Array<{
        type: string;
        content?: string;
        tool_use_id?: string;
      }>).find((block) => block.type === 'tool_result');

      expect(toolResultBlock).toBeDefined();
      expect(toolResultBlock!.content).toContain('Hello from test file');

      // stdout should contain the final text response
      expect(result.stdout).toContain('Hello! How can I help you today?');
    });
  });
});
