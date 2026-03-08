// src/dashboard/routes/runs.ts — Runs API Routes

import type { FastifyPluginAsync } from 'fastify';
import type { RunLogger } from '../../storage/run-logger.js';
import type { RunMetadata, RunLog } from '../../types/run.js';

export interface RunsRouteOptions {
  runLogger: RunLogger;
}

/**
 * Fastify plugin for /api/runs endpoints
 * 
 * GET /api/runs — List all runs with metadata
 * GET /api/runs/:id — Get full run details
 */
export const runsRoutes: FastifyPluginAsync<RunsRouteOptions> = async (fastify, opts) => {
  const { runLogger } = opts;

  // GET /api/runs — List all runs
  fastify.get('/api/runs', async (_request, reply) => {
    try {
      const runs = await runLogger.listRuns();
      return reply.send(runs);
    } catch (error) {
      fastify.log.error(error, 'Failed to list runs');
      return reply.status(500).send({ error: 'Failed to list runs' });
    }
  });

  // GET /api/runs/:id — Get full run details
  fastify.get<{
    Params: { id: string };
    Reply: RunLog | { error: string };
  }>('/api/runs/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const run = await runLogger.loadRun(id);

      if (!run) {
        return reply.status(404).send({ error: 'Not found' });
      }

      return reply.send(run);
    } catch (error) {
      fastify.log.error(error, `Failed to load run ${id}`);
      return reply.status(500).send({ error: 'Failed to load run' });
    }
  });
};
