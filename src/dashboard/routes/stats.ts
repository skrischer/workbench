// src/dashboard/routes/stats.ts — Stats API Routes

import type { FastifyPluginAsync } from 'fastify';
import type { RunLogger } from '../../storage/run-logger.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { PlanStorage } from '../../task/plan-storage.js';

export interface StatsRouteOptions {
  runLogger: RunLogger;
  sessionStorage: SessionStorage;
  planStorage: PlanStorage;
}

export interface StatsResponse {
  totalRuns: number;
  totalPlans: number;
  totalSessions: number;
  tokenUsage: {
    total: number;
    byModel: Record<string, number>;
  };
}

/**
 * Fastify plugin for /api/stats endpoints
 * 
 * GET /api/stats — Get aggregated system statistics
 */
export const statsRoutes: FastifyPluginAsync<StatsRouteOptions> = async (fastify, opts) => {
  const { runLogger, sessionStorage, planStorage } = opts;

  // GET /api/stats — Get aggregated statistics
  fastify.get<{
    Reply: StatsResponse | { error: string };
  }>('/api/stats', async (_request, reply) => {
    try {
      // Fetch all data in parallel
      const [runsResult, sessionsResult, plansResult] = await Promise.all([
        runLogger.listRuns({ limit: 10000 }),
        sessionStorage.list({ limit: 10000 }),
        planStorage.list({ limit: 10000 }),
      ]);

      const runs = runsResult.data;
      const sessions = sessionsResult.data;
      const plans = plansResult.data;

      // Aggregate token usage
      let totalTokens = 0;
      const byModel: Record<string, number> = {};

      for (const run of runs) {
        if (run.tokenUsage) {
          totalTokens += run.tokenUsage.totalTokens;
          
          // Track by model if metadata exists
          // Note: RunMetadata doesn't have model field in current schema
          // but we prepare for future extension
          const model = 'model' in run ? (run as any).model : 'unknown';
          byModel[model] = (byModel[model] || 0) + run.tokenUsage.totalTokens;
        }
      }

      const stats: StatsResponse = {
        totalRuns: runsResult.total,
        totalPlans: plansResult.total,
        totalSessions: sessionsResult.total,
        tokenUsage: {
          total: totalTokens,
          byModel,
        },
      };

      return reply.send(stats);
    } catch (error) {
      fastify.log.error(error, 'Failed to compute stats');
      return reply.status(500).send({ error: 'Failed to compute stats' });
    }
  });
};
