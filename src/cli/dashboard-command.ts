// src/cli/dashboard-command.ts — Dashboard CLI Command

import { Command } from 'commander';
import { createDashboard } from '../dashboard/create-dashboard.js';
import type { DashboardConfig } from '../dashboard/config.js';

/**
 * Dashboard command options
 */
interface DashboardCommandOptions {
  port?: number;
}

/**
 * Create the 'dashboard' command for the CLI.
 * 
 * Usage:
 *   workbench dashboard              # Start on default port 3000
 *   workbench dashboard --port 8080  # Start on custom port
 * 
 * Features:
 * - Start Fastify server with all routes and WebSocket
 * - Graceful shutdown on CTRL+C
 * - Clear error messages for port conflicts
 * 
 * @returns Commander.js Command instance
 */
export function createDashboardCommand(): Command {
  const command = new Command('dashboard');

  command
    .description('Start the Workbench dashboard server')
    .option('-p, --port <number>', 'Server port', parseInt)
    .action(async (options: DashboardCommandOptions) => {
      try {
        // Build config from CLI options
        const config: DashboardConfig = {};
        if (options.port !== undefined) {
          config.port = options.port;
        }

        // Create and start dashboard
        const dashboard = await createDashboard(config);
        
        await dashboard.start();

        // Server started successfully
        // (Fastify logger already prints listen address)
        console.log('✅ Dashboard server started');
        console.log('💡 Press CTRL+C to stop');
      } catch (error) {
        // Handle port conflict errors
        if (error && typeof error === 'object' && 'code' in error) {
          const nodeError = error as NodeJS.ErrnoException;
          if (nodeError.code === 'EADDRINUSE') {
            console.error('❌ Error: Port is already in use');
            console.error('💡 Try a different port with --port <number>');
            process.exit(1);
          }
        }

        // Handle other errors
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to start dashboard: ${message}`);
        
        if (error instanceof Error && error.stack) {
          console.error(error.stack);
        }
        
        process.exit(1);
      }
    });

  return command;
}
