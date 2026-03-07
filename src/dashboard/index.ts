// src/dashboard/index.ts — Dashboard Module Exports

export { createServer, startServer, stopServer } from './server.js';
export type { DashboardConfig } from './config.js';
export { getDashboardConfig } from './config.js';
export { attachWebSocket } from './ws-bridge.js';
