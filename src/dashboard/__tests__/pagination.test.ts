// src/dashboard/__tests__/pagination.test.ts — Pagination API Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { runsRoutes } from '../routes/runs.js';
import { plansRoutes } from '../routes/plans.js';
import { sessionsRoutes } from '../routes/sessions.js';
import { RunLogger } from '../../storage/run-logger.js';
import { PlanStorage } from '../../task/plan-storage.js';
import { SessionStorage } from '../../storage/session-storage.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

describe('Pagination API', () => {
  let app: FastifyInstance;
  let testDir: string;
  let runLogger: RunLogger;
  let planStorage: PlanStorage;
  let sessionStorage: SessionStorage;

  beforeEach(async () => {
    // Create temporary directory for test data
    testDir = await mkdtemp(join(tmpdir(), 'pagination-test-'));

    // Initialize storage instances
    runLogger = new RunLogger(testDir);
    planStorage = new PlanStorage(join(testDir, 'plans'));
    sessionStorage = new SessionStorage(join(testDir, 'sessions'));

    // Create and configure Fastify app
    app = Fastify({ logger: false });
    await app.register(runsRoutes, { runLogger });
    await app.register(plansRoutes, { planStorage });
    await app.register(sessionsRoutes, { sessionStorage });
  });

  afterEach(async () => {
    await app.close();
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('GET /api/runs', () => {
    it('should return default pagination (limit=50, offset=0)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('offset', 0);
      expect(body).toHaveProperty('limit', 50);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should accept custom limit and offset', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs?limit=10&offset=5',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(5);
    });

    it('should cap limit at 100', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs?limit=150',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.limit).toBe(100);
    });

    it('should return 400 for invalid limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs?limit=invalid',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid limit parameter');
    });

    it('should return 400 for invalid offset', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs?offset=-5',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid offset parameter');
    });

    it('should return empty result when no runs exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should return correct total count', async () => {
      // Create multiple runs
      for (let i = 0; i < 25; i++) {
        const runId = `test-run-${i}`;
        runLogger.startRun(runId, `Test prompt ${i}`);
        await runLogger.endRun(runId, 'completed');
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/runs?limit=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(25);
      expect(body.data.length).toBe(10);
    });

    it('should support sort parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs?sort=asc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
    });
  });

  describe('GET /api/plans', () => {
    it('should return default pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('offset', 0);
      expect(body).toHaveProperty('limit', 50);
    });

    it('should accept custom pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans?limit=20&offset=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.limit).toBe(20);
      expect(body.offset).toBe(10);
    });

    it('should return empty result when no plans exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });
  });

  describe('GET /api/sessions', () => {
    it('should return default pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('offset', 0);
      expect(body).toHaveProperty('limit', 50);
    });

    it('should accept custom pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions?limit=15&offset=3',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.limit).toBe(15);
      expect(body.offset).toBe(3);
    });

    it('should return empty result when no sessions exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should return correct total count with created sessions', async () => {
      // Create multiple sessions
      for (let i = 0; i < 15; i++) {
        await sessionStorage.create(`agent-${i}`);
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions?limit=10',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(15);
      expect(body.data.length).toBe(10);
    });
  });
});
