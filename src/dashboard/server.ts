// src/dashboard/server.ts — Fastify Dashboard Server

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import type { DashboardConfig } from './config.js';
import { getDashboardConfig } from './config.js';

const VERSION = '0.1.0';
const serverStartTime = Date.now();

/**
 * Health check response payload.
 */
interface HealthResponse {
  status: string;
  uptime: number;
  version: string;
}

/**
 * Create and configure a Fastify server instance.
 * 
 * Features:
 * - CORS support (configurable origin)
 * - WebSocket support
 * - Health check endpoint (GET /health)
 * - Graceful shutdown on SIGINT/SIGTERM
 * 
 * @param config - Dashboard configuration
 * @returns Configured Fastify instance
 */
export async function createServer(config: DashboardConfig = {}): Promise<FastifyInstance> {
  const resolvedConfig = getDashboardConfig(config);

  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // Register CORS plugin
  await fastify.register(cors, {
    origin: resolvedConfig.corsOrigin,
  });

  // Register WebSocket plugin
  await fastify.register(websocket);

  // Health check endpoint
  fastify.get<{ Reply: HealthResponse }>('/health', async (_request, reply) => {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    
    return reply.send({
      status: 'ok',
      uptime,
      version: VERSION,
    });
  });

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await fastify.close();
      fastify.log.info('Server closed successfully');
      process.exit(0);
    } catch (err) {
      fastify.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return fastify;
}

/**
 * Start the Fastify server on configured host and port.
 * 
 * @param fastify - Fastify instance
 * @param config - Dashboard configuration
 */
export async function startServer(
  fastify: FastifyInstance,
  config: DashboardConfig = {}
): Promise<void> {
  const resolvedConfig = getDashboardConfig(config);

  try {
    await fastify.listen({
      port: resolvedConfig.port,
      host: resolvedConfig.host,
    });
    fastify.log.info(
      `Dashboard server listening on http://${resolvedConfig.host}:${resolvedConfig.port}`
    );
  } catch (err) {
    fastify.log.error(err, 'Failed to start server');
    throw err;
  }
}

/**
 * Stop the Fastify server.
 * 
 * @param fastify - Fastify instance
 */
export async function stopServer(fastify: FastifyInstance): Promise<void> {
  try {
    await fastify.close();
    fastify.log.info('Server stopped');
  } catch (err) {
    fastify.log.error(err, 'Error stopping server');
    throw err;
  }
}
