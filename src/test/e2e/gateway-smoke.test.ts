import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestGateway, type GatewayTestRunner } from '../gateway-runner.js';
import { simpleText } from '../__fixtures__/index.js';
import type { AddressInfo } from 'node:net';

describe('Gateway Smoke', () => {
  let runner: GatewayTestRunner;
  let baseUrl: string;

  beforeAll(async () => {
    runner = await createTestGateway({
      fixtures: [{ response: simpleText }],
    });

    const address = runner.gateway.app.server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await runner?.close();
  });

  // --- Gateway Lifecycle ---

  describe('Gateway Lifecycle', () => {
    it('should respond to health check', async () => {
      const res = await fetch(`${baseUrl}/health`);
      expect(res.ok).toBe(true);

      const body = (await res.json()) as { status: string };
      expect(body).toEqual({ status: 'ok' });
    });

    it('should shut down gracefully via close()', async () => {
      // Lifecycle test: create a separate gateway, close it, verify no error
      const tempRunner = await createTestGateway({
        fixtures: [{ response: simpleText }],
      });
      await expect(tempRunner.close()).resolves.toBeUndefined();
    });
  });

  // --- WebSocket Connection ---

  describe('WebSocket Connection', () => {
    it('should have an open WebSocket connection', () => {
      // WebSocket is connected by createTestGateway — readyState 1 = OPEN
      expect(runner.ws.readyState).toBe(1);
    });
  });

  // --- Session Management ---

  describe('Session Management', () => {
    it('should return empty session list on fresh environment', async () => {
      const result = await runner.sendCommand('list_sessions');
      expect(result).toEqual([]);
    });

    it('should create a session and return object with id', async () => {
      const session = (await runner.sendCommand('create_session')) as {
        id: string;
      };
      expect(session).toBeDefined();
      expect(typeof session.id).toBe('string');
      expect(session.id.length).toBeGreaterThan(0);
    });

    it('should load a previously created session', async () => {
      const created = (await runner.sendCommand('create_session')) as {
        id: string;
      };
      const loaded = (await runner.sendCommand('load_session', {
        id: created.id,
      })) as { id: string };
      expect(loaded).toBeDefined();
      expect(loaded.id).toBe(created.id);
    });

    it('should list sessions after creation', async () => {
      const sessions = (await runner.sendCommand('list_sessions')) as Array<{
        id: string;
      }>;
      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --- Error Handling ---

  describe('Error Handling', () => {
    it('should reject load_session with invalid id', async () => {
      await expect(
        runner.sendCommand('load_session', { id: 'nonexistent-id-12345' }),
      ).rejects.toThrow();
    });

    it('should reject unknown commands', async () => {
      // Cast to bypass type check — we intentionally send an invalid command
      await expect(
        runner.sendCommand(
          'totally_invalid_command' as Parameters<typeof runner.sendCommand>[0],
        ),
      ).rejects.toThrow(/unknown command/i);
    });
  });
});
