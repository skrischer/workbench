// src/dashboard/index.ts — Dashboard Module Exports

export { createServer, startServer, stopServer } from './server.js';
export type { DashboardConfig } from './config.js';
export { getDashboardConfig } from './config.js';
export { attachWebSocket } from './ws-bridge.js';
export { createDashboard } from './create-dashboard.js';
export type { DashboardInstance } from './create-dashboard.js';
