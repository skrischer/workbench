// src/dashboard/routes/sessions.ts — Sessions API Routes

import type { FastifyPluginAsync } from 'fastify';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { Session, SessionStatus } from '../../types/index.js';
import { isNotFoundError } from '../../types/errors.js';

export interface SessionsRouteOptions {
  sessionStorage: SessionStorage;
}

/**
 * Fastify plugin for /api/sessions endpoints
 * 
 * GET /api/sessions — List all sessions with metadata
 * GET /api/sessions/:id — Get full session details
 */
export const sessionsRoutes: FastifyPluginAsync<SessionsRouteOptions> = async (fastify, opts) => {
  const { sessionStorage } = opts;

  // GET /api/sessions — List all sessions with pagination
  fastify.get<{
    Querystring: {
      limit?: string;
      offset?: string;
      sort?: 'asc' | 'desc';
    };
  }>('/api/sessions', async (request, reply) => {
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

      const result = await sessionStorage.list({ limit, offset, sort });
      return reply.send(result);
    } catch (error) {
      fastify.log.error(error, 'Failed to list sessions');
      return reply.status(500).send({ error: 'Failed to list sessions' });
    }
  });

  // GET /api/sessions/:id — Get full session details
  fastify.get<{
    Params: { id: string };
    Reply: Session | { error: string };
  }>('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const session = await sessionStorage.load(id);
      return reply.send(session);
    } catch (error) {
      if (isNotFoundError(error)) {
        return reply.status(404).send({ error: 'Not found' });
      }

      fastify.log.error(error, `Failed to load session ${id}`);
      return reply.status(500).send({ error: 'Failed to load session' });
    }
  });
};
