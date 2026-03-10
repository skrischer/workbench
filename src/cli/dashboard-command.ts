// src/cli/dashboard-command.ts — Dashboard CLI Command

import { Command } from 'commander';
import { createDashboard } from '../dashboard/create-dashboard.js';
import type { DashboardConfig } from '../dashboard/config.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Dashboard command options
 */
interface DashboardCommandOptions {
  port?: number;
  build?: boolean;
}

/**
 * Create the 'dashboard' command for the CLI.
 * 
 * Usage:
 *   workbench dashboard              # Start on default port 3000
 *   workbench dashboard --port 8080  # Start on custom port
 *   workbench dashboard --build      # Auto-build UI if missing
 * 
 * Features:
 * - Start Fastify server with all routes and WebSocket
 * - Check for UI build and warn if missing
 * - Optional auto-build with --build flag
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
    .option('-b, --build', 'Automatically build UI if not present')
    .action(async (options: DashboardCommandOptions) => {
      try {
        // Build config from CLI options
        const config: DashboardConfig = {};
        if (options.port !== undefined) {
          config.port = options.port;
        }

        // Check if UI is built
        const uiDistPath = path.join(__dirname, '..', 'dashboard', 'ui', 'dist');

        if (!fs.existsSync(uiDistPath)) {
          console.warn('⚠️  Dashboard UI not built. Run: cd src/dashboard/ui && npm run build');
          
          if (options.build) {
            console.log('🔨 Building UI...');
            execSync('cd src/dashboard/ui && npm run build', { stdio: 'inherit' });
          } else {
            console.log('ℹ️  Dashboard API will run, but UI won\'t be available.');
          }
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
