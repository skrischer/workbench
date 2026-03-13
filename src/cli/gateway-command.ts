// src/cli/gateway-command.ts — CLI command for starting the Gateway service
import { Command } from 'commander';

export function createGatewayCommand(): Command {
  const cmd = new Command('gateway');
  cmd
    .description('Start the Workbench Gateway (unified API + Web UI server)')
    .option('--dev', 'Enable Vite dev server with HMR')
    .option('--port <port>', 'Server port', (v: string) => parseInt(v, 10), 4800)
    .option('--host <host>', 'Server host', '127.0.0.1')
    .action(async (options: { dev?: boolean; port: number; host: string }) => {
      const { createGateway } = await import('../gateway/index.js');

      const { close } = await createGateway({
        host: options.host,
        port: options.port,
        dev: options.dev ?? false,
      });

      // Graceful shutdown on SIGTERM/SIGINT
      const shutdown = async (): Promise<void> => {
        console.log('\nShutting down gateway...');
        await close();
        process.exit(0);
      };

      process.on('SIGTERM', () => void shutdown());
      process.on('SIGINT', () => void shutdown());
    });

  return cmd;
}
