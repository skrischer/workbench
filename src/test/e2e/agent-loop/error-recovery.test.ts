import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMockAnthropicServer, type MockAnthropicServer } from '../../mock-anthropic-server.js';
import { createTestEnv, type TestEnv } from '../../test-env.js';
import { runCli } from '../../cli-runner.js';
import { simpleText } from '../../__fixtures__/index.js';

describe('E2E Agent Loop - Error Recovery', () => {
  describe('Tool Error Handling (File Not Found)', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    // Custom tool_use fixture for reading non-existent file
    const readNonexistentFile = {
      id: 'msg_test_err_001',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me read that file.' },
        {
          type: 'tool_use',
          id: 'toolu_err_001',
          name: 'read_file',
          input: { path: 'nonexistent-file.txt' },
        },
      ],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: { input_tokens: 20, output_tokens: 30 },
    };

    beforeAll(async () => {
      // Mock server response queue:
      // 1. tool_use for read_file (non-existent file)
      // 2. final text response (agent acknowledges error)
      mockServer = await createMockAnthropicServer([
        { response: readNonexistentFile },
        { response: simpleText },
      ]);

      // Create test env with NO special files
      // (the file the agent tries to read won't exist)
      testEnv = await createTestEnv({
        anthropicApiUrl: `${mockServer.url}/v1/messages`,
      });
    });

    afterAll(async () => {
      await mockServer?.close();
      await testEnv?.cleanup();
    });

    it('should handle tool errors gracefully and send error as tool_result', async () => {
      const result = await runCli({
        args: ['run', 'read nonexistent-file.txt'],
        env: testEnv.env,
        cwd: testEnv.workbenchHome,
        timeout: 15000,
      });

      // Agent should NOT crash - exit cleanly
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

      // Second request: must contain tool_result with error
      const secondCall = mockServer.calls[1];
      expect(secondCall.body.messages).toBeDefined();
      const secondMessages = secondCall.body.messages as Array<{
        role: string;
        content: Array<{ type: string; content?: string; is_error?: boolean; tool_use_id?: string }> | string;
      }>;

      // Find the user message with tool_result
      const userMessageWithToolResult = secondMessages.find(
        (msg) => msg.role === 'user' && Array.isArray(msg.content)
      );
      expect(userMessageWithToolResult).toBeDefined();

      // Verify tool_result exists and contains error
      const toolResultBlock = (
        userMessageWithToolResult!.content as Array<{
          type: string;
          content?: string;
          is_error?: boolean;
          tool_use_id?: string;
        }>
      ).find((block) => block.type === 'tool_result');

      expect(toolResultBlock).toBeDefined();
      expect(toolResultBlock!.tool_use_id).toBe('toolu_err_001');

      // Tool result should indicate error
      // Check for error flag OR error content
      const hasErrorFlag = toolResultBlock!.is_error === true;
      const hasErrorContent =
        toolResultBlock!.content &&
        (toolResultBlock!.content.includes('Failed to read file') ||
          toolResultBlock!.content.includes('ENOENT') ||
          toolResultBlock!.content.includes('no such file'));

      expect(hasErrorFlag || hasErrorContent).toBe(true);

      // stdout should contain the final text response (agent didn't crash)
      expect(result.stdout).toContain('Hello! How can I help you today?');
    });
  });
});
