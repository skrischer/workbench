// src/dashboard/routes/index.ts — Route Registration

import type { FastifyInstance } from 'fastify';
import type { RunLogger } from '../../storage/run-logger.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { PlanStorage } from '../../task/plan-storage.js';
import { runsRoutes } from './runs.js';
import { plansRoutes } from './plans.js';
import { sessionsRoutes } from './sessions.js';
import { statsRoutes } from './stats.js';
import { metricsRoutes } from './metrics.js';

export interface RouteDependencies {
  runLogger: RunLogger;
  sessionStorage: SessionStorage;
  planStorage: PlanStorage;
}

/**
 * Register all API routes with the Fastify instance
 * 
 * @param fastify - Fastify instance
 * @param deps - Storage dependencies
 */
export async function registerRoutes(
  fastify: FastifyInstance,
  deps: RouteDependencies
): Promise<void> {
  // Register runs routes
  await fastify.register(runsRoutes, {
    runLogger: deps.runLogger,
  });

  // Register plans routes
  await fastify.register(plansRoutes, {
    planStorage: deps.planStorage,
  });

  // Register sessions routes
  await fastify.register(sessionsRoutes, {
    sessionStorage: deps.sessionStorage,
  });

  // Register stats routes
  await fastify.register(statsRoutes, {
    runLogger: deps.runLogger,
    sessionStorage: deps.sessionStorage,
    planStorage: deps.planStorage,
  });

  // Register metrics routes (Prometheus-compatible)
  await fastify.register(metricsRoutes, {
    runLogger: deps.runLogger,
    sessionStorage: deps.sessionStorage,
  });
}
