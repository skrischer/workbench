// src/dashboard/__tests__/server.test.ts — Dashboard Server Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer, startServer, stopServer } from '../server.js';
import type { DashboardConfig } from '../config.js';

describe('Dashboard Server', () => {
  let server: FastifyInstance;

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  describe('Health Endpoint', () => {
    it('should respond with status ok and uptime', async () => {
      server = await createServer();
      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('version', '0.1.0');
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should increment uptime between calls', async () => {
      server = await createServer();
      await server.ready();

      const response1 = await server.inject({
        method: 'GET',
        url: '/health',
      });
      const body1 = JSON.parse(response1.body);

      // Wait 1 second
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response2 = await server.inject({
        method: 'GET',
        url: '/health',
      });
      const body2 = JSON.parse(response2.body);

      expect(body2.uptime).toBeGreaterThanOrEqual(body1.uptime);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', async () => {
      const config: DashboardConfig = {};
      server = await createServer(config);
      await server.ready();

      // Verify server is created successfully with defaults
      expect(server).toBeDefined();
      
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });
      expect(response.statusCode).toBe(200);
    });

    it('should accept custom configuration', async () => {
      const config: DashboardConfig = {
        port: 4000,
        host: '127.0.0.1',
        corsOrigin: 'https://example.com',
      };

      server = await createServer(config);
      await server.ready();

      expect(server).toBeDefined();
      
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('Server Lifecycle', () => {
    it('should start and stop server successfully', async () => {
      server = await createServer({ port: 3001 });

      // Start server
      await startServer(server, { port: 3001 });
      expect(server.server.listening).toBe(true);

      // Stop server
      await stopServer(server);
      expect(server.server.listening).toBe(false);
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers in response', async () => {
      server = await createServer({ corsOrigin: '*' });
      await server.ready();

      const response = await server.inject({
        method: 'GET',
        url: '/health',
        headers: {
          origin: 'https://example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('*');
    });

    it('should respect custom CORS origin', async () => {
      const customOrigin = 'https://custom-origin.com';
      server = await createServer({ corsOrigin: customOrigin });
      await server.ready();

      const response = await server.inject({
        method: 'OPTIONS',
        url: '/health',
        headers: {
          origin: customOrigin,
          'access-control-request-method': 'GET',
        },
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(customOrigin);
    });
  });
});
