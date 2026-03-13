// src/cli/web-command.ts — CLI command for starting the web UI server (DEPRECATED)

import { Command } from 'commander';

export function createWebCommand(): Command {
  const cmd = new Command('web');
  cmd
    .description('[DEPRECATED] Start the Workbench Web UI server — use "workbench gateway" instead')
    .option('--port <port>', 'Server port', parseInt, 4800)
    .option('--host <host>', 'Server host', '127.0.0.1')
    .option('--open', 'Open browser after start')
    .action(async (options: { port: number; host: string; open?: boolean }) => {
      console.warn('⚠️  "workbench web" is deprecated. Use "workbench gateway" instead.');
      console.warn('   The Gateway provides the same Web UI plus WebSocket API for TUI and CLI.');
      console.warn('');

      // Delegate to gateway
      const { createGateway } = await import('../gateway/index.js');
      await createGateway({
        host: options.host,
        port: options.port,
      });

      if (options.open) {
        const { exec } = await import('node:child_process');
        const url = `http://${options.host}:${options.port}`;
        const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
        exec(`${openCmd} ${url}`);
      }
    });

  return cmd;
}
