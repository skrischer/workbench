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

export async function createServer(deps: ServerDeps, options: ServerOptions = {}) {
  const { host = '127.0.0.1', port = 3000 } = options;

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

  // SPA fallback — serve index.html for non-file routes
  app.setNotFoundHandler((_req, reply) => {
    return reply.sendFile('index.html', webDistDir);
  });

  // Start server
  await app.listen({ host, port });
  console.log(`Workbench Web UI: http://${host}:${port}`);

  return {
    app,
    bridge,
    close: async () => {
      bridge.close();
      await app.close();
    },
  };
}
