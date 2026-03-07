// src/dashboard/create-dashboard.ts — Dashboard Factory

import type { FastifyInstance } from 'fastify';
import { createServer, startServer, stopServer } from './server.js';
import { registerRoutes } from './routes/index.js';
import { attachWebSocket } from './ws-bridge.js';
import { TypedEventBus } from '../events/event-bus.js';
import { RunLogger } from '../storage/run-logger.js';
import { SessionStorage } from '../storage/session-storage.js';
import { PlanStorage } from '../task/plan-storage.js';
import type { DashboardConfig } from './config.js';
import type { EventMap } from '../types/events.js';

/**
 * Dashboard instance with server and lifecycle methods
 */
export interface DashboardInstance {
  server: FastifyInstance;
  eventBus: TypedEventBus<EventMap>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Create a complete dashboard instance with all components wired up.
 * 
 * Components:
 * - Fastify server (CORS + WebSocket + Health check)
 * - API routes (/api/runs, /api/plans, /api/sessions)
 * - WebSocket bridge (/ws)
 * - EventBus for real-time event broadcasting
 * - Storage instances (RunLogger, SessionStorage, PlanStorage)
 * 
 * @param config - Dashboard configuration (port, host, CORS)
 * @returns Dashboard instance with start/stop methods
 */
export function createDashboard(config: DashboardConfig = {}): DashboardInstance {
  // 1. Create Fastify server
  const server = createServer(config);

  // 2. Create EventBus
  const eventBus = new TypedEventBus<EventMap>();

  // 3. Create Storage instances
  const runLogger = new RunLogger();
  const sessionStorage = new SessionStorage();
  const planStorage = new PlanStorage();

  // 4. Register API routes
  registerRoutes(server, {
    runLogger,
    sessionStorage,
    planStorage,
  });

  // 5. Attach WebSocket bridge
  attachWebSocket(server, eventBus);

  // 6. Return instance with lifecycle methods
  return {
    server,
    eventBus,
    start: async () => {
      await startServer(server, config);
    },
    stop: async () => {
      await stopServer(server);
    },
  };
}
