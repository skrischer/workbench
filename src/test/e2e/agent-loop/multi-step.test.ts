import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createMockAnthropicServer, type MockAnthropicServer } from '../../mock-anthropic-server.js';
import { createTestEnv, type TestEnv } from '../../test-env.js';
import { runCli } from '../../cli-runner.js';

describe('E2E Agent Loop - Multi-Step Tool Chain', () => {
  describe('Complete Multi-Turn Tool Chain (read → write)', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      // Create inline tool_use responses for multi-step chain
      const readFileResponse = {
        id: 'msg_test_multi_001',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me read that file first.' },
          {
            type: 'tool_use',
            id: 'toolu_001',
            name: 'read_file',
            input: { path: 'input.txt' },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 20, output_tokens: 30 },
      };

      const writeFileResponse = {
        id: 'msg_test_multi_002',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Now let me write the output file.' },
          {
            type: 'tool_use',
            id: 'toolu_002',
            name: 'write_file',
            input: { path: 'output.txt', content: 'processed content' },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: { input_tokens: 40, output_tokens: 50 },
      };

      const finalResponse = {
        id: 'msg_test_multi_003',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Done! I read input.txt and wrote to output.txt.' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 60, output_tokens: 20 },
      };

      // Mock server response queue: read → write → final text
      mockServer = await createMockAnthropicServer([
        { response: readFileResponse },
        { response: writeFileResponse },
        { response: finalResponse },
      ]);

      testEnv = await createTestEnv({
        anthropicApiUrl: `${mockServer.url}/v1/messages`,
      });

      // Create input file with original content
      const inputFilePath = path.join(testEnv.workbenchHome, 'input.txt');
      await writeFile(inputFilePath, 'original content', 'utf-8');
    });

    afterAll(async () => {
      await mockServer?.close();
      await testEnv?.cleanup();
    });

    // TODO Epic 27: Test duration 8-10s (CLI spawn + mock server + tool execution).
    it('should complete multi-step tool chain: read → write → done', async () => {
      const result = await runCli({
        args: ['run', 'read input.txt and write to output.txt'],
        env: testEnv.env,
        cwd: testEnv.workbenchHome,
        timeout: 20000,
      });

      // Should exit cleanly
      expect(result.timedOut).toBe(false);
      expect(result.exitCode).toBe(0);

      // Should contact mock server exactly 3 times
      expect(mockServer.calls.length).toBe(3);

      // First request: initial user message
      const firstCall = mockServer.calls[0];
      expect(firstCall.body.messages).toBeDefined();
      const firstMessages = firstCall.body.messages as Array<{ role: string; content: unknown }>;
      expect(firstMessages.length).toBeGreaterThanOrEqual(1);
      expect(firstMessages[0].role).toBe('user');

      // Second request: should have assistant message + tool_result for read_file
      const secondCall = mockServer.calls[1];
      expect(secondCall.body.messages).toBeDefined();
      const secondMessages = secondCall.body.messages as Array<{
        role: string;
        content: Array<{ type: string; content?: string; tool_use_id?: string }> | string;
      }>;

      // Should have more messages than first request (conversation is growing)
      expect(secondMessages.length).toBeGreaterThan(firstMessages.length);

      // Find the tool_result for read_file
      const readToolResult = secondMessages
        .filter((msg) => msg.role === 'user' && Array.isArray(msg.content))
        .flatMap((msg) => msg.content as Array<{ type: string; content?: string; tool_use_id?: string }>)
        .find((block) => block.type === 'tool_result' && block.tool_use_id === 'toolu_001');

      expect(readToolResult).toBeDefined();
      expect(readToolResult!.content).toContain('original content');

      // Third request: should have 2 tool_results (read + write)
      const thirdCall = mockServer.calls[2];
      expect(thirdCall.body.messages).toBeDefined();
      const thirdMessages = thirdCall.body.messages as Array<{
        role: string;
        content: Array<{ type: string; content?: string; tool_use_id?: string }> | string;
      }>;

      // Should have even more messages (conversation continues growing)
      expect(thirdMessages.length).toBeGreaterThan(secondMessages.length);

      // Find the tool_result for write_file
      const writeToolResult = thirdMessages
        .filter((msg) => msg.role === 'user' && Array.isArray(msg.content))
        .flatMap((msg) => msg.content as Array<{ type: string; content?: string; tool_use_id?: string }>)
        .find((block) => block.type === 'tool_result' && block.tool_use_id === 'toolu_002');

      expect(writeToolResult).toBeDefined();
      expect(writeToolResult!.content).toContain('Successfully wrote');

      // Verify output.txt was actually written to disk
      const outputFilePath = path.join(testEnv.workbenchHome, 'output.txt');
      const outputContent = await readFile(outputFilePath, 'utf-8');
      expect(outputContent).toBe('processed content');

      // stdout should contain the final text response
      expect(result.stdout).toContain('Done! I read input.txt and wrote to output.txt.');
    });
  });
});
