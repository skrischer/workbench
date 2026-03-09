// src/dashboard/routes/metrics.ts — Prometheus Metrics Endpoint

import type { FastifyPluginAsync } from 'fastify';
import type { RunLogger } from '../../storage/run-logger.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { RunLogStatus } from '../../types/run.js';

export interface MetricsRouteOptions {
  runLogger: RunLogger;
  sessionStorage: SessionStorage;
}

/**
 * Generate Prometheus text format metrics.
 * 
 * Format:
 * ```
 * # HELP metric_name Description
 * # TYPE metric_name counter|gauge
 * metric_name{label="value"} 123
 * ```
 * 
 * @param data - Metrics data
 * @returns Prometheus text format string
 */
function formatPrometheusMetrics(data: {
  runsByStatus: Record<RunLogStatus, number>;
  totalSessions: number;
  totalTokens: number;
  activeWsConnections: number;
  uptimeSeconds: number;
}): string {
  const lines: string[] = [];

  // workbench_runs_total (Counter)
  lines.push('# HELP workbench_runs_total Total number of agent runs by status');
  lines.push('# TYPE workbench_runs_total counter');
  for (const [status, count] of Object.entries(data.runsByStatus)) {
    lines.push(`workbench_runs_total{status="${status}"} ${count}`);
  }

  // workbench_sessions_total (Counter)
  lines.push('# HELP workbench_sessions_total Total number of sessions');
  lines.push('# TYPE workbench_sessions_total counter');
  lines.push(`workbench_sessions_total ${data.totalSessions}`);

  // workbench_tokens_used_total (Counter)
  lines.push('# HELP workbench_tokens_used_total Total number of tokens used across all runs');
  lines.push('# TYPE workbench_tokens_used_total counter');
  lines.push(`workbench_tokens_used_total ${data.totalTokens}`);

  // workbench_ws_connections_active (Gauge)
  lines.push('# HELP workbench_ws_connections_active Number of active WebSocket connections');
  lines.push('# TYPE workbench_ws_connections_active gauge');
  lines.push(`workbench_ws_connections_active ${data.activeWsConnections}`);

  // workbench_uptime_seconds (Gauge)
  lines.push('# HELP workbench_uptime_seconds Server uptime in seconds');
  lines.push('# TYPE workbench_uptime_seconds gauge');
  lines.push(`workbench_uptime_seconds ${data.uptimeSeconds}`);

  return lines.join('\n') + '\n';
}

/**
 * Fastify plugin for /metrics endpoint (Prometheus-compatible)
 * 
 * GET /metrics — Prometheus text format metrics
 */
export const metricsRoutes: FastifyPluginAsync<MetricsRouteOptions> = async (fastify, opts) => {
  const { runLogger, sessionStorage } = opts;

  // GET /metrics — Prometheus metrics
  fastify.get('/metrics', async (_request, reply) => {
    try {
      // Fetch data in parallel
      const [runs, sessions] = await Promise.all([
        runLogger.listRuns(),
        sessionStorage.list(),
      ]);

      // Count runs by status
      const runsByStatus: Record<RunLogStatus, number> = {
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };

      for (const run of runs.data) {
        runsByStatus[run.status] = (runsByStatus[run.status] || 0) + 1;
      }

      // Calculate total tokens
      let totalTokens = 0;
      for (const run of runs.data) {
        if (run.tokenUsage) {
          totalTokens += run.tokenUsage.totalTokens;
        }
      }

      // Server uptime (in seconds)
      const uptimeSeconds = Math.floor(process.uptime());

      // TODO: WebSocket connection tracking
      // ws-bridge.ts maintains a local clients Map but doesn't export it.
      // For v1, we return 0. Future: export connection count from ws-bridge.
      const activeWsConnections = 0;

      // Generate Prometheus text format
      const metricsText = formatPrometheusMetrics({
        runsByStatus,
        totalSessions: sessions.total,
        totalTokens,
        activeWsConnections,
        uptimeSeconds,
      });

      return reply
        .header('Content-Type', 'text/plain; version=0.0.4')
        .send(metricsText);
    } catch (error) {
      fastify.log.error(error, 'Failed to generate metrics');
      return reply.status(500).send({ error: 'Failed to generate metrics' });
    }
  });
};
