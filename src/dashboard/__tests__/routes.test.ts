// src/dashboard/__tests__/routes.test.ts — Tests for API Routes

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

describe('API Routes', () => {
  let tempDir: string;
  let fastify: FastifyInstance;
  let runLogger: RunLogger;
  let sessionStorage: SessionStorage;
  let planStorage: PlanStorage;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'routes-test-'));
    
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

  describe('GET /api/runs', () => {
    it('should return empty result when no runs exist', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/runs',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return list of runs with metadata', async () => {
      // Create test runs
      runLogger.startRun('run-1', 'Test prompt 1');
      await runLogger.endRun('run-1', 'completed', {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });

      runLogger.startRun('run-2', 'Test prompt 2');
      await runLogger.endRun('run-2', 'failed');

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/runs',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      const runs = result.data;
      expect(runs[0].id).toBe('run-2'); // Note: sorted by date desc, so run-2 is first
      expect(runs[0].status).toBe('failed');
      expect(runs[1].id).toBe('run-1');
      expect(runs[1].status).toBe('completed');
      expect(runs[1].tokenUsage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });
    });
  });

  describe('GET /api/runs/:id', () => {
    it('should return 404 for non-existent run', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/runs/non-existent',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Not found' });
    });

    it('should return full run details', async () => {
      runLogger.startRun('run-3', 'Full details test');
      runLogger.logStep('run-3', { role: 'user', content: 'Hello' }, 0);
      runLogger.logToolCall(
        'run-3',
        {
          toolName: 'test_tool',
          input: { arg: 'value' },
          output: 'result',
          durationMs: 100,
        },
        1
      );
      await runLogger.endRun('run-3', 'completed');

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/runs/run-3',
      });

      expect(response.statusCode).toBe(200);
      const run = JSON.parse(response.payload);
      expect(run.metadata.id).toBe('run-3');
      expect(run.metadata.prompt).toBe('Full details test');
      expect(run.messages).toHaveLength(1);
      expect(run.messages[0].content).toBe('Hello');
      expect(run.toolCalls).toHaveLength(1);
      expect(run.toolCalls[0].toolName).toBe('test_tool');
    });
  });

  describe('GET /api/plans', () => {
    it('should return empty result when no plans exist', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/plans',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return list of plans with metadata', async () => {
      // Create test plans
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
          {
            id: 'step-2',
            title: 'Step 2',
            prompt: 'Do another thing',
            status: 'pending',
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

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/plans',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      const plans = result.data;
      // Plans are sorted by createdAt desc, so order might be reversed
      const foundPlan1 = plans.find((p: any) => p.id === 'plan-1');
      const foundPlan2 = plans.find((p: any) => p.id === 'plan-2');
      expect(foundPlan1).toBeDefined();
      expect(foundPlan1.title).toBe('Test Plan 1');
      expect(plans[0].stepCount).toBe(1);
      expect(plans[1].id).toBe('plan-2');
      expect(plans[1].stepCount).toBe(2);
    });
  });

  describe('GET /api/plans/:id', () => {
    it('should return 404 for non-existent plan', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/plans/non-existent',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Not found' });
    });

    it('should return full plan details', async () => {
      const plan: Plan = {
        id: 'plan-3',
        title: 'Full Plan Test',
        description: 'Description',
        status: 'pending',
        steps: [
          {
            id: 'step-1',
            title: 'First Step',
            prompt: 'Do first thing',
            status: 'pending',
          },
        ],
        currentStepIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          originalPrompt: 'Original',
          model: 'test-model',
        },
      };

      await planStorage.create(plan);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/plans/plan-3',
      });

      expect(response.statusCode).toBe(200);
      const loadedPlan = JSON.parse(response.payload);
      expect(loadedPlan.id).toBe('plan-3');
      expect(loadedPlan.title).toBe('Full Plan Test');
      expect(loadedPlan.steps).toHaveLength(1);
      expect(loadedPlan.steps[0].title).toBe('First Step');
    });
  });

  describe('GET /api/sessions', () => {
    it('should return empty result when no sessions exist', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return list of sessions with metadata', async () => {
      // Create test sessions
      const session1 = await sessionStorage.create('agent-1');
      await sessionStorage.addMessage(session1.id, {
        role: 'user',
        content: 'Hello',
        timestamp: new Date().toISOString(),
      });

      const session2 = await sessionStorage.create('agent-2');

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      const sessions = result.data;
      
      // Sort by agentId to ensure stable ordering (filesystem order may vary)
      const sortedSessions = sessions.sort((a: any, b: any) => 
        a.agentId.localeCompare(b.agentId)
      );
      
      expect(sortedSessions[0].agentId).toBe('agent-1');
      expect(sortedSessions[0].messageCount).toBe(1);
      expect(sortedSessions[1].agentId).toBe('agent-2');
      expect(sortedSessions[1].messageCount).toBe(0);
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should return 404 for non-existent session', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/sessions/non-existent',
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Not found' });
    });

    it('should return full session details', async () => {
      const session = await sessionStorage.create('agent-3');
      await sessionStorage.addMessage(session.id, {
        role: 'user',
        content: 'Test message',
        timestamp: new Date().toISOString(),
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/sessions/${session.id}`,
      });

      expect(response.statusCode).toBe(200);
      const loadedSession = JSON.parse(response.payload);
      expect(loadedSession.id).toBe(session.id);
      expect(loadedSession.agentId).toBe('agent-3');
      expect(loadedSession.messages).toHaveLength(1);
      expect(loadedSession.messages[0].content).toBe('Test message');
    });
  });
});
