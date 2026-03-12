// src/server/index.ts — Fastify Web Server Setup
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TypedEventBus } from '../events/event-bus.js';
import type { SessionStorage } from '../storage/session-storage.js';
import type { AgentLoop } from '../runtime/agent-loop.js';
import { createWsBridge } from './ws-bridge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ServerDeps {
  eventBus: TypedEventBus;
  sessionStorage: SessionStorage;
  agentLoop: AgentLoop;
}

export interface ServerOptions {
  host?: string;
  port?: number;
}

/**
 * Create and configure the Fastify server with WebSocket, static files, and SPA fallback.
 * Does NOT call listen() — the caller is responsible for starting the server.
 */
export async function createServer(deps: ServerDeps) {
  const app = Fastify({ logger: false });

  // Register WebSocket plugin
  await app.register(fastifyWebsocket);

  // Serve static web UI files (from Vite build output)
  const webDistDir = path.resolve(__dirname, '../../dist/web');
  await app.register(fastifyStatic, {
    root: webDistDir,
    prefix: '/',
    decorateReply: false,
  });

  // WebSocket endpoint
  const bridge = createWsBridge(deps);
  app.get('/ws', { websocket: true }, (socket) => {
    bridge.handleConnection(socket);
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  // SPA fallback — serve index.html for non-file routes
  app.setNotFoundHandler((_req, reply) => {
    return reply.sendFile('index.html', webDistDir);
  });

  return {
    app,
    bridge,
    close: async () => {
      bridge.close();
      await app.close();
    },
  };
}
