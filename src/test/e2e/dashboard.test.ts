// src/test/e2e/dashboard.test.ts — Dashboard E2E Tests

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { createTestEnv, type TestEnv } from '../test-env.js';
import { runCli } from '../cli-runner.js';

/**
 * Find an available port by trying to listen on it.
 */
async function findFreePort(): Promise<number> {
  const { createServer } = await import('node:net');
  
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        reject(new Error('Failed to get port'));
      }
    });
  });
}

/**
 * Wait for a dashboard server to become ready by polling the health endpoint.
 */
async function waitForServer(port: number, timeoutMs = 10000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet, continue waiting
    }
    
    // Wait 100ms before next attempt
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  
  throw new Error(`Server did not become ready within ${timeoutMs}ms`);
}

/**
 * Spawn dashboard server as a background process.
 */
function spawnDashboard(port: number, env?: Record<string, string>): ChildProcess {
  // Path to compiled CLI entry point (relative to source file location)
  // import.meta.dirname points to src/test/e2e/
  // So we go up three levels to project root and then to dist/cli/index.js
  const cliPath = path.resolve(import.meta.dirname, '../../../dist/cli/index.js');
  
  const child = spawn('node', [cliPath, 'dashboard', '--port', String(port)], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  
  return child;
}

describe('E2E Dashboard Tests', () => {
  describe('Dashboard Help', () => {
    it('workbench dashboard --help should show port option', async () => {
      const result = await runCli({
        args: ['dashboard', '--help'],
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.stdout.toLowerCase()).toContain('port');
    });
  });

  describe('Dashboard Starts and Serves API', () => {
    let testEnv: TestEnv;
    let dashboardProcess: ChildProcess;
    let port: number;

    beforeAll(async () => {
      testEnv = await createTestEnv();
      port = await findFreePort();
      
      // Spawn dashboard server
      dashboardProcess = spawnDashboard(port, testEnv.env);
      
      // Wait for server to be ready
      await waitForServer(port, 15000);
    });

    afterAll(async () => {
      // Kill dashboard process
      if (dashboardProcess && !dashboardProcess.killed) {
        dashboardProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          dashboardProcess.on('exit', resolve);
          setTimeout(resolve, 2000); // Timeout fallback
        });
      }
      
      await testEnv?.cleanup();
    });

    it('should start and respond to health check', async () => {
      const response = await fetch(`http://localhost:${port}/health`);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('uptime');
    });

    it('should serve /api/sessions endpoint', async () => {
      const response = await fetch(`http://localhost:${port}/api/sessions`);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('offset');
      expect(data).toHaveProperty('limit');
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should serve /api/runs endpoint', async () => {
      const response = await fetch(`http://localhost:${port}/api/runs`);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('offset');
      expect(data).toHaveProperty('limit');
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('API Prefix Regression (PR #14)', () => {
    let testEnv: TestEnv;
    let dashboardProcess: ChildProcess;
    let port: number;

    beforeAll(async () => {
      testEnv = await createTestEnv();
      port = await findFreePort();
      
      // Spawn dashboard server
      dashboardProcess = spawnDashboard(port, testEnv.env);
      
      // Wait for server to be ready
      await waitForServer(port, 15000);
    });

    afterAll(async () => {
      // Kill dashboard process
      if (dashboardProcess && !dashboardProcess.killed) {
        dashboardProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          dashboardProcess.on('exit', resolve);
          setTimeout(resolve, 2000);
        });
      }
      
      await testEnv?.cleanup();
    });

    it('should serve API routes at /api/sessions (NOT /api/api/sessions)', async () => {
      // Correct path should work
      const correctResponse = await fetch(`http://localhost:${port}/api/sessions`);
      expect(correctResponse.status).toBe(200);
      
      // Double-prefix path should NOT work (404)
      const doubleResponse = await fetch(`http://localhost:${port}/api/api/sessions`);
      expect(doubleResponse.status).toBe(404);
    });

    it('should serve API routes at /api/runs (NOT /api/api/runs)', async () => {
      // Correct path should work
      const correctResponse = await fetch(`http://localhost:${port}/api/runs`);
      expect(correctResponse.status).toBe(200);
      
      // Double-prefix path should NOT work (404)
      const doubleResponse = await fetch(`http://localhost:${port}/api/api/runs`);
      expect(doubleResponse.status).toBe(404);
    });
  });

  describe('Port Conflict Handling', () => {
    let testEnv: TestEnv;
    let firstProcess: ChildProcess;
    let port: number;

    beforeAll(async () => {
      testEnv = await createTestEnv();
      port = await findFreePort();
    });

    afterAll(async () => {
      // Clean up first process
      if (firstProcess && !firstProcess.killed) {
        firstProcess.kill('SIGTERM');
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      
      await testEnv?.cleanup();
    });

    it('should error when port is already in use', async () => {
      // Start first dashboard
      firstProcess = spawnDashboard(port, testEnv.env);
      await waitForServer(port, 15000);
      
      // Try to start second dashboard on same port
      const result = await runCli({
        args: ['dashboard', '--port', String(port)],
        env: testEnv.env,
        timeout: 10000,
      });
      
      // Should fail with non-zero exit code
      expect(result.exitCode).not.toBe(0);
      
      // Should mention port conflict in error
      const output = result.stderr + result.stdout;
      expect(output.toLowerCase()).toMatch(/port|already.*use|eaddrinuse/i);
    });
  });
});
