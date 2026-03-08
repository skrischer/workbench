import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createMockAnthropicServer, type MockAnthropicServer } from '../../mock-anthropic-server.js';
import { createTestEnv, type TestEnv } from '../../test-env.js';
import { runCli } from '../../cli-runner.js';
import { simpleText, toolUseReadFile } from '../../__fixtures__/index.js';
import type { Session } from '../../../types/index.js';

describe('E2E Agent Loop - Session Persistence', () => {
  describe('Session Files Created', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      // Mock server returns simple text response
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

    it('should create a session file after workbench run', async () => {
      const result = await runCli({
        args: ['run', 'say hello'],
        env: testEnv.env,
        cwd: testEnv.workbenchHome,
        timeout: 15000,
      });

      // Should complete successfully
      expect(result.timedOut).toBe(false);
      if (result.exitCode !== 0) {
        console.error('CLI failed with stderr:', result.stderr);
        console.error('CLI stdout:', result.stdout);
      }
      expect(result.exitCode).toBe(0);

      // Check sessions directory
      const sessionsDir = path.join(testEnv.workbenchHome, 'sessions');
      const sessionDirs = await readdir(sessionsDir, { withFileTypes: true });
      const sessionFolders = sessionDirs.filter((entry) => entry.isDirectory());

      // At least one session should exist
      expect(sessionFolders.length).toBeGreaterThanOrEqual(1);

      // Read the first session file
      const sessionId = sessionFolders[0].name;
      const sessionPath = path.join(sessionsDir, sessionId, 'session.json');
      const sessionContent = await readFile(sessionPath, 'utf-8');

      // Parse and validate JSON structure
      const session: Session = JSON.parse(sessionContent);

      // Verify required fields
      expect(session.id).toBe(sessionId);
      expect(session.agentId).toBeDefined();
      expect(session.status).toBeDefined();
      expect(session.messages).toBeInstanceOf(Array);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();

      // Verify messages contain user and assistant
      expect(session.messages.length).toBeGreaterThanOrEqual(2);

      const userMessage = session.messages.find((msg) => msg.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage!.content).toContain('say hello');

      const assistantMessage = session.messages.find((msg) => msg.role === 'assistant');
      expect(assistantMessage).toBeDefined();
    });
  });

  describe('Session with Tool Use', () => {
    let mockServer: MockAnthropicServer;
    let testEnv: TestEnv;

    beforeAll(async () => {
      // Mock server returns tool_use, then simple text
      mockServer = await createMockAnthropicServer([
        { response: toolUseReadFile },
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

    it('should capture tool_use and tool_result in session messages', async () => {
      const result = await runCli({
        args: ['run', 'read a file'],
        env: testEnv.env,
        cwd: testEnv.workbenchHome,
        timeout: 15000,
      });

      // Should complete successfully
      expect(result.timedOut).toBe(false);
      if (result.exitCode !== 0) {
        console.error('CLI failed with stderr:', result.stderr);
        console.error('CLI stdout:', result.stdout);
      }
      expect(result.exitCode).toBe(0);

      // Load session file
      const sessionsDir = path.join(testEnv.workbenchHome, 'sessions');
      const sessionDirs = await readdir(sessionsDir, { withFileTypes: true });
      const sessionFolders = sessionDirs.filter((entry) => entry.isDirectory());

      expect(sessionFolders.length).toBeGreaterThanOrEqual(1);

      const sessionId = sessionFolders[0].name;
      const sessionPath = path.join(sessionsDir, sessionId, 'session.json');
      const sessionContent = await readFile(sessionPath, 'utf-8');
      const session: Session = JSON.parse(sessionContent);

      // Verify session contains tool interactions
      expect(session.messages.length).toBeGreaterThanOrEqual(3);

      // Check for tool message (tool_result)
      const toolMessage = session.messages.find(
        (msg) => msg.role === 'tool'
      );
      expect(toolMessage).toBeDefined();
      expect(toolMessage).toHaveProperty('toolCallId');
      expect(typeof toolMessage!.content).toBe('string');

      // Verify we have both user and assistant messages
      const userMessage = session.messages.find((msg) => msg.role === 'user');
      expect(userMessage).toBeDefined();

      const assistantMessages = session.messages.filter((msg) => msg.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThanOrEqual(1);
    });
  });
});
