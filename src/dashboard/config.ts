// src/dashboard/config.ts — Dashboard Server Configuration

/**
 * Configuration for the Fastify dashboard server.
 */
export interface DashboardConfig {
  /** Server port (default: 3000) */
  port?: number;
  
  /** Server host (default: '0.0.0.0') */
  host?: string;
  
  /** CORS origin (default: '*') */
  corsOrigin?: string | string[] | RegExp;
  
  /** 
   * WebSocket authentication token (default: null, no auth required)
   * When set, clients must provide this token via `?token=XYZ` query parameter.
   * Can be set via WORKBENCH_WS_TOKEN environment variable.
   */
  wsToken?: string | null;
}

/**
 * Get dashboard configuration with defaults applied.
 */
export function getDashboardConfig(config: DashboardConfig = {}): Required<DashboardConfig> {
  return {
    port: config.port ?? 3000,
    host: config.host ?? '0.0.0.0',
    corsOrigin: config.corsOrigin ?? '*',
    wsToken: config.wsToken ?? process.env.WORKBENCH_WS_TOKEN ?? null,
  };
}
