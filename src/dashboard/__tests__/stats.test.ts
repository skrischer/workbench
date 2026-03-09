// src/dashboard/__tests__/stats.test.ts — Tests for Stats API Routes

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
import type { Plan } from '../../types/task.js';
import type { StatsResponse } from '../routes/stats.js';

describe('Stats API Routes', () => {
  let tempDir: string;
  let fastify: FastifyInstance;
  let runLogger: RunLogger;
  let sessionStorage: SessionStorage;
  let planStorage: PlanStorage;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'stats-test-'));
    
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

  describe('GET /api/stats', () => {
    it('should return zero stats when system is empty', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/stats',
      });

      expect(response.statusCode).toBe(200);
      const stats: StatsResponse = JSON.parse(response.payload);
      
      expect(stats.totalRuns).toBe(0);
      expect(stats.totalPlans).toBe(0);
      expect(stats.totalSessions).toBe(0);
      expect(stats.tokenUsage.total).toBe(0);
      expect(stats.tokenUsage.byModel).toEqual({});
    });

    it('should return aggregated stats with data', async () => {
      // Create runs with token usage
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
      await runLogger.endRun('run-3', 'failed'); // No token usage

      // Create sessions
      await sessionStorage.create('agent-1');
      await sessionStorage.create('agent-2');

      // Create plans
      const plan1: Plan = {
        id: 'plan-1',
        title: 'Test Plan 1',
        description: 'Description 1',
        status: 'completed',
        steps: [
          {
            id: 'step-1',
            title: 'Step 1',
            prompt: 'Do something',
            status: 'completed',
          },
        ],
        currentStepIndex: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          originalPrompt: 'Original prompt 1',
          model: 'test-model',
        },
      };

      const plan2: Plan = {
        id: 'plan-2',
        title: 'Test Plan 2',
        description: 'Description 2',
        status: 'running',
        steps: [
          {
            id: 'step-1',
            title: 'Step 1',
            prompt: 'Do something',
            status: 'running',
          },
        ],
        currentStepIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          originalPrompt: 'Original prompt 2',
          model: 'test-model',
        },
      };

      await planStorage.create(plan1);
      await planStorage.create(plan2);

      // Fetch stats
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/stats',
      });

      expect(response.statusCode).toBe(200);
      const stats: StatsResponse = JSON.parse(response.payload);
      
      expect(stats.totalRuns).toBe(3);
      expect(stats.totalPlans).toBe(2);
      expect(stats.totalSessions).toBe(2);
      expect(stats.tokenUsage.total).toBe(450); // 150 + 300
      expect(stats.tokenUsage.byModel).toHaveProperty('unknown'); // No model in RunMetadata
    });

    it('should return correct response schema', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/stats',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      
      const stats: StatsResponse = JSON.parse(response.payload);
      
      // Validate schema
      expect(typeof stats.totalRuns).toBe('number');
      expect(typeof stats.totalPlans).toBe('number');
      expect(typeof stats.totalSessions).toBe('number');
      expect(typeof stats.tokenUsage).toBe('object');
      expect(typeof stats.tokenUsage.total).toBe('number');
      expect(typeof stats.tokenUsage.byModel).toBe('object');
    });
  });
});
