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

  // GET /api/sessions — List all sessions
  fastify.get('/api/sessions', async (_request, reply) => {
    try {
      const sessions = await sessionStorage.list();
      return reply.send(sessions);
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
