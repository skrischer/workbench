// src/cli/web-command.ts — CLI command for starting the web UI server

import { Command } from 'commander';
import { homedir } from 'node:os';
import path from 'node:path';

export function createWebCommand(): Command {
  const cmd = new Command('web');
  cmd
    .description('Start the Workbench Web UI server')
    .option('--port <port>', 'Server port', parseInt, 3000)
    .option('--host <host>', 'Server host', '127.0.0.1')
    .option('--open', 'Open browser after start')
    .action(async (options: { port: number; host: string; open?: boolean }) => {
      const { TypedEventBus } = await import('../events/event-bus.js');
      const { SessionStorage } = await import('../storage/session-storage.js');
      const { ToolRegistry } = await import('../tools/registry.js');
      const { AgentLoop } = await import('../runtime/agent-loop.js');
      const { AnthropicClient } = await import('../llm/anthropic-client.js');
      const { TokenRefresher } = await import('../llm/token-refresh.js');
      const { TokenStorage } = await import('../llm/token-storage.js');
      const { loadAgentConfig } = await import('../agent/config.js');
      const { createServer } = await import('../server/index.js');

      const workbenchHome = process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
      const tokenPath = path.join(workbenchHome, 'tokens.json');
      const tokenStorage = new TokenStorage(tokenPath);
      const tokenRefresher = new TokenRefresher(tokenStorage);

      const eventBus = new TypedEventBus();
      const sessionStorage = new SessionStorage(undefined, eventBus);
      const toolRegistry = new ToolRegistry();
      const agentConfig = await loadAgentConfig();
      const anthropicClient = new AnthropicClient(tokenRefresher, {
        model: agentConfig.model,
        apiUrl: process.env.ANTHROPIC_API_URL,
      });
      const agentLoop = new AgentLoop(
        anthropicClient,
        sessionStorage,
        toolRegistry,
        agentConfig,
        eventBus,
      );

      const { app } = await createServer({ eventBus, sessionStorage, agentLoop });

      await app.listen({ host: options.host, port: options.port });
      console.log(`Workbench Web UI running at http://${options.host}:${options.port}`);

      if (options.open) {
        const { exec } = await import('node:child_process');
        const url = `http://${options.host}:${options.port}`;
        const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
        exec(`${openCmd} ${url}`);
      }
    });

  return cmd;
}
