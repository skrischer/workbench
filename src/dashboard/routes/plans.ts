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

  // GET /api/plans — List all plans
  fastify.get('/api/plans', async (_request, reply) => {
    try {
      const plans = await planStorage.list();
      return reply.send(plans);
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
