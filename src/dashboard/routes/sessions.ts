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
 * POST /api/sessions/create — Create a new session
 * POST /api/sessions/:id/message — Add a message to a session
 * GET /api/sessions/:id/messages — Get all messages for a session
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
      
      // Extend metadata with parentId
      const extendedData = await Promise.all(
        result.data.map(async (meta) => {
          const session = await sessionStorage.load(meta.id);
          return {
            ...meta,
            parentId: session.parentId,
          };
        })
      );

      return reply.send({
        ...result,
        data: extendedData,
      });
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

  // POST /api/sessions/create — Create a new session
  fastify.post<{
    Body: {
      agentId?: string;
      initialPrompt?: string;
    };
    Reply: { sessionId: string } | { error: string };
  }>('/api/sessions/create', async (request, reply) => {
    try {
      const { agentId, initialPrompt } = request.body;
      const session = await sessionStorage.createSession(agentId, initialPrompt);
      return reply.send({ sessionId: session.id });
    } catch (error) {
      fastify.log.error(error, 'Failed to create session');
      return reply.status(500).send({ error: 'Failed to create session' });
    }
  });

  // POST /api/sessions/:id/message — Add a message to a session
  fastify.post<{
    Params: { id: string };
    Body: {
      message: string;
    };
    Reply: { success: boolean } | { error: string };
  }>('/api/sessions/:id/message', async (request, reply) => {
    const { id } = request.params;
    const { message } = request.body;

    try {
      // Append message to session
      await sessionStorage.appendMessage(id, { role: 'user', content: message });

      // TODO: Agent-Loop für Session starten (Integration mit runtime)

      return reply.send({ success: true });
    } catch (error) {
      if (isNotFoundError(error)) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      fastify.log.error(error, `Failed to add message to session ${id}`);
      return reply.status(500).send({ error: 'Failed to add message' });
    }
  });

  // GET /api/sessions/:id/messages — Get all messages for a session
  fastify.get<{
    Params: { id: string };
    Reply: { messages: Session['messages'] } | { error: string };
  }>('/api/sessions/:id/messages', async (request, reply) => {
    const { id } = request.params;

    try {
      const session = await sessionStorage.load(id);
      return reply.send({ messages: session.messages });
    } catch (error) {
      if (isNotFoundError(error)) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      fastify.log.error(error, `Failed to load messages for session ${id}`);
      return reply.status(500).send({ error: 'Failed to load messages' });
    }
  });
};
