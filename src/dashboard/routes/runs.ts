// src/dashboard/routes/runs.ts — Runs API Routes

import type { FastifyPluginAsync } from 'fastify';
import type { RunLogger } from '../../storage/run-logger.js';
import type { RunMetadata, RunLog } from '../../types/run.js';
import { isNotFoundError } from '../../types/errors.js';

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

  // GET /api/runs — List all runs with pagination
  fastify.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      sort?: 'asc' | 'desc';
    };
  }>('/api/runs', async (request, reply) => {
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

      const result = await runLogger.listRuns({ limit, offset, sort });
      return reply.send(result);
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
      return reply.send(run);
    } catch (error) {
      if (isNotFoundError(error)) {
        return reply.status(404).send({ error: 'Not found' });
      }

      fastify.log.error(error, `Failed to load run ${id}`);
      return reply.status(500).send({ error: 'Failed to load run' });
    }
  });
};
