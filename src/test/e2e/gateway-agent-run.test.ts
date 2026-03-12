import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createTestGateway, type GatewayTestRunner } from '../gateway-runner.js';
import { simpleText, toolUseReadFile } from '../__fixtures__/index.js';

describe('E2E - Agent Run via Gateway', () => {
  describe('1. Simple Agent Run', () => {
    let runner: GatewayTestRunner;

    beforeAll(async () => {
      runner = await createTestGateway({
        fixtures: [{ response: simpleText }],
      });
    });

    afterAll(async () => {
      await runner?.close();
    });

    it('should run agent and receive run lifecycle events', async () => {
      // Create session
      const session = (await runner.sendCommand('create_session')) as {
        id: string;
      };
      expect(session.id).toBeDefined();

      // Register event waiters BEFORE sending message to avoid race conditions
      const startPromise = runner.waitForEvent('run:start');
      const stepPromise = runner.waitForEvent('run:step');
      const endPromise = runner.waitForEvent('run:end');

      // Send message (fire-and-forget, returns { status: 'started' })
      const sendResult = (await runner.sendCommand('send_message', {
        sessionId: session.id,
        prompt: 'hello',
      })) as { status: string };
      expect(sendResult.status).toBe('started');

      // Wait for run lifecycle events
      const startEvt = await startPromise;
      expect(startEvt.data).toHaveProperty('runId');
      expect(startEvt.data).toHaveProperty('prompt', 'hello');

      // Wait for run:step with the assistant response
      const stepEvt = await stepPromise;
      expect(stepEvt.data).toHaveProperty('runId');
      expect(stepEvt.data).toHaveProperty('stepIndex');
      expect(stepEvt.data).toHaveProperty('message');

      // Wait for run:end
      const endEvt = await endPromise;
      expect(endEvt.data).toHaveProperty('runId');
      expect(endEvt.data).toHaveProperty('result');
      expect(endEvt.data).toHaveProperty('tokenUsage');

      // Mock server should have received exactly 1 call
      expect(runner.mockServer.calls.length).toBe(1);
    });
  });

  describe('2. Tool Use Cycle', () => {
    let runner: GatewayTestRunner;

    beforeAll(async () => {
      runner = await createTestGateway({
        fixtures: [
          { response: toolUseReadFile },
          { response: simpleText },
        ],
      });

      // Create test file for the read_file tool
      const testFilePath = path.join(runner.testEnv.workbenchHome, 'test-file.txt');
      await writeFile(testFilePath, 'Hello from test file', 'utf-8');
    });

    afterAll(async () => {
      await runner?.close();
    });

    it('should handle tool_use cycle and emit tool events', async () => {
      // Collect tool events
      const toolCalls = runner.collectEvents('tool:call');
      const toolResults = runner.collectEvents('tool:result');

      // Create session
      const session = (await runner.sendCommand('create_session')) as {
        id: string;
      };

      // Register event waiters BEFORE sending message
      const startPromise = runner.waitForEvent('run:start');
      const callPromise = runner.waitForEvent('tool:call');
      const resultPromise = runner.waitForEvent('tool:result');
      const endPromise = runner.waitForEvent('run:end');

      // Send message
      await runner.sendCommand('send_message', {
        sessionId: session.id,
        prompt: 'read the test file',
      });

      // Wait for run:start
      await startPromise;

      // Wait for tool:call event (read_file)
      const callEvt = await callPromise;
      expect(callEvt.data).toHaveProperty('toolName', 'read_file');

      // Wait for tool:result event
      const resultEvt = await resultPromise;
      expect(resultEvt.data).toHaveProperty('toolName', 'read_file');
      expect(resultEvt.data).toHaveProperty('durationMs');

      // Wait for run:end
      const endEvt = await endPromise;
      expect(endEvt.data).toHaveProperty('runId');

      // Verify tool events were collected
      expect(toolCalls.length).toBeGreaterThanOrEqual(1);
      expect(toolResults.length).toBeGreaterThanOrEqual(1);

      // Mock server should have received 2 calls (initial + after tool_result)
      expect(runner.mockServer.calls.length).toBe(2);
    });
  });

  describe('3. Error Handling', () => {
    let runner: GatewayTestRunner;

    beforeAll(async () => {
      runner = await createTestGateway({
        fixtures: [{ response: simpleText }],
      });
    });

    afterAll(async () => {
      await runner?.close();
    });

    it('should return error for load_session with non-existent id', async () => {
      await expect(
        runner.sendCommand('load_session', { id: 'non-existent-session-id' }),
      ).rejects.toThrow(/not found/i);
    });
  });
});
