// src/dashboard/routes/plans.ts — Plans API Routes

import type { FastifyPluginAsync } from 'fastify';
import type { PlanStorage } from '../../task/plan-storage.js';
import type { Plan } from '../../types/task.js';
import { isNotFoundError } from '../../types/errors.js';

export interface PlansRouteOptions {
  planStorage: PlanStorage;
}

/**
 * Fastify plugin for /api/plans endpoints
 * 
 * GET /api/plans — List all plans with metadata
 * GET /api/plans/:id — Get full plan details
 */
export const plansRoutes: FastifyPluginAsync<PlansRouteOptions> = async (fastify, opts) => {
  const { planStorage } = opts;

  // GET /api/plans — List all plans with pagination
  fastify.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      sort?: 'asc' | 'desc';
    };
  }>('/api/plans', async (request, reply) => {
    try {
      // Parse query parameters
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : undefined;
      const offset = request.query.offset ? parseInt(request.query.offset, 10) : undefined;
      const sort = request.query.sort;

      // Validate numeric parameters
      if (limit !== undefined && (isNaN(limit) || limit < 1)) {
        return reply.status(400).send({ error: 'Invalid limit parameter' });
      }
      if (offset !== undefined && (isNaN(offset) || offset < 0)) {
        return reply.status(400).send({ error: 'Invalid offset parameter' });
      }

      const result = await planStorage.list({ limit, offset, sort });
      return reply.send(result);
    } catch (error) {
      fastify.log.error(error, 'Failed to list plans');
      return reply.status(500).send({ error: 'Failed to list plans' });
    }
  });

  // GET /api/plans/:id — Get full plan details
  fastify.get<{
    Params: { id: string };
    Reply: Plan | { error: string };
  }>('/api/plans/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const plan = await planStorage.load(id);
      return reply.send(plan);
    } catch (error) {
      if (isNotFoundError(error)) {
        return reply.status(404).send({ error: 'Not found' });
      }

      fastify.log.error(error, `Failed to load plan ${id}`);
      return reply.status(500).send({ error: 'Failed to load plan' });
    }
  });
};
