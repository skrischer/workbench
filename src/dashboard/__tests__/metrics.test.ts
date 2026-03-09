// src/dashboard/__tests__/metrics.test.ts — Tests for Prometheus Metrics Endpoint

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import Fastify, { FastifyInstance } from 'fastify';
import { RunLogger } from '../../storage/run-logger.js';
import { SessionStorage } from '../../storage/session-storage.js';
import { PlanStorage } from '../../task/plan-storage.js';
import { registerRoutes } from '../routes/index.js';

describe('Metrics API Routes', () => {
  let tempDir: string;
  let fastify: FastifyInstance;
  let runLogger: RunLogger;
  let sessionStorage: SessionStorage;
  let planStorage: PlanStorage;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'metrics-test-'));
    
    // Initialize storage instances with temp directory
    runLogger = new RunLogger(tempDir);
    sessionStorage = new SessionStorage(join(tempDir, 'sessions'));
    planStorage = new PlanStorage(join(tempDir, 'plans'));

    // Create Fastify instance
    fastify = Fastify();

    // Register routes
    await registerRoutes(fastify, {
      runLogger,
      sessionStorage,
      planStorage,
    });

    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('GET /metrics', () => {
    it('should return Prometheus text format with correct Content-Type', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/plain; version=0.0.4');
      expect(typeof response.payload).toBe('string');
    });

    it('should include all required metrics', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = response.payload;

      // Check for required metrics
      expect(body).toContain('workbench_runs_total');
      expect(body).toContain('workbench_sessions_total');
      expect(body).toContain('workbench_tokens_used_total');
      expect(body).toContain('workbench_ws_connections_active');
      expect(body).toContain('workbench_uptime_seconds');
    });

    it('should include HELP and TYPE lines for each metric', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = response.payload;

      // Check for HELP lines
      expect(body).toContain('# HELP workbench_runs_total');
      expect(body).toContain('# HELP workbench_sessions_total');
      expect(body).toContain('# HELP workbench_tokens_used_total');
      expect(body).toContain('# HELP workbench_ws_connections_active');
      expect(body).toContain('# HELP workbench_uptime_seconds');

      // Check for TYPE lines
      expect(body).toContain('# TYPE workbench_runs_total counter');
      expect(body).toContain('# TYPE workbench_sessions_total counter');
      expect(body).toContain('# TYPE workbench_tokens_used_total counter');
      expect(body).toContain('# TYPE workbench_ws_connections_active gauge');
      expect(body).toContain('# TYPE workbench_uptime_seconds gauge');
    });

    it('should return correct values with empty system', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = response.payload;

      // All run status counters should be 0
      expect(body).toContain('workbench_runs_total{status="running"} 0');
      expect(body).toContain('workbench_runs_total{status="completed"} 0');
      expect(body).toContain('workbench_runs_total{status="failed"} 0');
      expect(body).toContain('workbench_runs_total{status="cancelled"} 0');

      // Other metrics should be 0 (except uptime)
      expect(body).toContain('workbench_sessions_total 0');
      expect(body).toContain('workbench_tokens_used_total 0');
      expect(body).toContain('workbench_ws_connections_active 0');
      
      // Uptime should be > 0
      expect(body).toMatch(/workbench_uptime_seconds \d+/);
    });

    it('should return correct values with data', async () => {
      // Create runs with different statuses
      runLogger.startRun('run-1', 'Test prompt 1');
      await runLogger.endRun('run-1', 'completed', {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });

      runLogger.startRun('run-2', 'Test prompt 2');
      await runLogger.endRun('run-2', 'completed', {
        inputTokens: 200,
        outputTokens: 100,
        totalTokens: 300,
      });

      runLogger.startRun('run-3', 'Test prompt 3');
      await runLogger.endRun('run-3', 'failed');

      runLogger.startRun('run-4', 'Test prompt 4');
      await runLogger.endRun('run-4', 'running'); // Mark as running (not common, but valid for testing)

      // Create sessions
      await sessionStorage.create('agent-1');
      await sessionStorage.create('agent-2');
      await sessionStorage.create('agent-3');

      // Fetch metrics
      const response = await fastify.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = response.payload;

      // Check run counts by status
      expect(body).toContain('workbench_runs_total{status="completed"} 2');
      expect(body).toContain('workbench_runs_total{status="failed"} 1');
      expect(body).toContain('workbench_runs_total{status="running"} 1');

      // Check sessions
      expect(body).toContain('workbench_sessions_total 3');

      // Check tokens (150 + 300 = 450)
      expect(body).toContain('workbench_tokens_used_total 450');
    });

    it('should handle runs without token usage', async () => {
      // Create run without token usage
      runLogger.startRun('run-1', 'Test prompt 1');
      await runLogger.endRun('run-1', 'completed'); // No token usage

      const response = await fastify.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = response.payload;

      // Token count should be 0
      expect(body).toContain('workbench_tokens_used_total 0');
    });

    it('should format metrics according to Prometheus spec', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = response.payload;

      // Each line should be one of:
      // - Comment (starts with #)
      // - Metric line (metric_name{labels} value)
      // - Empty line
      const lines = body.split('\n');

      for (const line of lines) {
        if (line.trim() === '') continue; // Empty lines OK

        // Comment line
        if (line.startsWith('#')) {
          expect(line).toMatch(/^# (HELP|TYPE) \w+/);
          continue;
        }

        // Metric line
        expect(line).toMatch(/^\w+(\{[^}]+\})? \d+/);
      }
    });
  });
});
