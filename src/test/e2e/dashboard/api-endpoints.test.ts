// src/test/e2e/dashboard/api-endpoints.test.ts — API Endpoints E2E Tests (inject-based)

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDashboard, type DashboardInstance } from '../../../dashboard/create-dashboard.js';
import { createTestEnv, type TestEnv } from '../../test-env.js';

describe('Dashboard API Endpoints (inject)', () => {
  let testEnv: TestEnv;
  let dashboard: DashboardInstance;
  let app: FastifyInstance;

  beforeAll(async () => {
    // Create test environment with WORKBENCH_HOME
    testEnv = await createTestEnv();
    
    // Set WORKBENCH_HOME for storage instances
    process.env.WORKBENCH_HOME = testEnv.workbenchHome;
    
    // Create dashboard with server and routes
    dashboard = await createDashboard({ port: 0, host: 'localhost' });
    app = dashboard.server;
    
    // Prepare server (required before inject)
    await app.ready();
  });

  afterAll(async () => {
    // Close server
    await app.close();
    
    // Clean up test environment
    await testEnv.cleanup();
  });

  describe('Health Check', () => {
    it('GET /health returns 200 with status, uptime, version', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('version');
      expect(typeof data.uptime).toBe('number');
      expect(typeof data.version).toBe('string');
    });
  });

  describe('Sessions API', () => {
    it('GET /api/sessions returns 200 with array', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);
    });

    it('GET /api/sessions returns application/json content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Runs API', () => {
    it('GET /api/runs returns 200 with array', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs',
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);
    });

    it('GET /api/runs returns application/json content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('Plans API', () => {
    it('GET /api/plans returns 200 with array', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans',
      });

      expect(response.statusCode).toBe(200);
      
      const data = JSON.parse(response.body);
      expect(Array.isArray(data)).toBe(true);
    });

    it('GET /api/plans returns application/json content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('404 for Unknown Routes', () => {
    it('GET /api/nonexistent returns 404', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });

    it('GET /invalid returns 404', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/invalid',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('No Double Prefix Regression (PR #14)', () => {
    it('GET /api/api/sessions returns 404 (NOT 200)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/api/sessions',
      });

      // Must NOT match — double prefix is wrong
      expect(response.statusCode).toBe(404);
    });

    it('GET /api/api/runs returns 404 (NOT 200)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/api/runs',
      });

      // Must NOT match — double prefix is wrong
      expect(response.statusCode).toBe(404);
    });

    it('GET /api/api/plans returns 404 (NOT 200)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/api/plans',
      });

      // Must NOT match — double prefix is wrong
      expect(response.statusCode).toBe(404);
    });

    it('Correct paths still work: /api/sessions returns 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(200);
    });

    it('Correct paths still work: /api/runs returns 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/runs',
      });

      expect(response.statusCode).toBe(200);
    });

    it('Correct paths still work: /api/plans returns 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/plans',
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
