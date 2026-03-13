// src/gateway/index.ts — Gateway Service (unified Fastify + Vite dev server)
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import type { FastifyInstance } from 'fastify';
import { TypedEventBus } from '../events/event-bus.js';
import { SessionStorage } from '../storage/session-storage.js';
import { AgentLoop } from '../runtime/agent-loop.js';
import type { AgentLoopHooks } from '../runtime/agent-loop.js';
import { AnthropicClient } from '../llm/anthropic-client.js';
import { TokenRefresher } from '../llm/token-refresh.js';
import { TokenStorage } from '../llm/token-storage.js';
import { loadAgentConfig } from '../agent/config.js';
import { createDefaultTools } from '../tools/defaults.js';
import { RunLogger } from '../storage/run-logger.js';
import { LanceDBMemoryStore } from '../memory/lancedb-store.js';
import { createAutoMemoryHook } from '../memory/auto-memory.js';
import { loadUserConfig } from '../config/user-config.js';
import { AgentRegistry } from '../multi-agent/agent-registry.js';
import { MessageBus } from '../multi-agent/message-bus.js';
import { AgentOrchestrator } from '../multi-agent/orchestrator.js';
import { createWsBridge } from '../server/ws-bridge.js';
import type { WsBridge } from '../server/ws-bridge.js';
import type { AgentConfig, ToolResult, Session, RunResult } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

export interface GatewayOptions {
  host?: string;
  port?: number;
  dev?: boolean;
}

export interface Gateway {
  app: FastifyInstance;
  bridge: WsBridge;
  agentLoop: AgentLoop;
  eventBus: TypedEventBus;
  close: () => Promise<void>;
}

export async function createGateway(options: GatewayOptions = {}): Promise<Gateway> {
  const { host = '127.0.0.1', port = 4800, dev = false } = options;

  // Initialize dependencies
  const workbenchHome = process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
  const tokenPath = path.join(workbenchHome, 'tokens.json');
  const tokenStorage = new TokenStorage(tokenPath);
  const tokenRefresher = new TokenRefresher(tokenStorage);

  const eventBus = new TypedEventBus();
  const sessionStorage = new SessionStorage(undefined, eventBus);

  // Multi-agent infrastructure
  const agentRegistry = new AgentRegistry();
  const messageBus = new MessageBus();

  // Tool registry with all default tools (including memory + multi-agent tools)
  const memoryStore = new LanceDBMemoryStore({
    dbPath: path.join(workbenchHome, 'memory'),
  });
  const toolRegistry = createDefaultTools({ agentRegistry, messageBus, memoryStore });

  const agentConfig = await loadAgentConfig();
  if (!agentConfig.tools || agentConfig.tools.length === 0) {
    agentConfig.tools = toolRegistry.list();
  }

  const anthropicClient = new AnthropicClient(tokenRefresher, {
    model: agentConfig.model,
    apiUrl: process.env.ANTHROPIC_API_URL,
  });

  const orchestrator = new AgentOrchestrator(
    agentRegistry, messageBus, anthropicClient, sessionStorage, toolRegistry
  );

  // RunLogger + AutoMemory hooks (analog to run-command.ts)
  const runLogger = new RunLogger(workbenchHome);
  const userConfig = await loadUserConfig();
  const autoMemoryHook = createAutoMemoryHook({
    sessionStorage, runLogger, memoryStore, userConfig,
  });

  const hooks: AgentLoopHooks = {
    onBeforeRun: async (session: Session) => {
      runLogger.startRun(session.id, '');
    },
    onAfterStep: async (result: ToolResult, context: { runId: string; stepIndex: number; toolName: string }) => {
      runLogger.logToolCall(context.runId, {
        toolName: context.toolName, input: {}, output: result.output, durationMs: 0,
      }, context.stepIndex);
    },
    onAfterRun: async (result: RunResult, context: { runId: string }) => {
      const status: 'completed' | 'failed' | 'cancelled' =
        result.status === 'failed' ? 'failed' : 'completed';
      const tokenUsage = {
        inputTokens: result.tokenUsage.input_tokens,
        outputTokens: result.tokenUsage.output_tokens,
        totalTokens: result.tokenUsage.input_tokens + result.tokenUsage.output_tokens,
      };
      await runLogger.endRun(context.runId, status, tokenUsage);
      if (autoMemoryHook) await autoMemoryHook(result, context);
    },
  };

  const agentLoop = new AgentLoop(
    anthropicClient,
    sessionStorage,
    toolRegistry,
    agentConfig,
    eventBus,
    hooks,
    undefined,
    agentRegistry,
    orchestrator,
  );

  // Create Fastify instance
  const app = Fastify({ logger: false });

  // WebSocket plugin (must be registered before routes)
  await app.register(fastifyWebsocket);

  // WebSocket endpoint
  const bridge = createWsBridge({ eventBus, sessionStorage, agentLoop });
  app.get('/ws', { websocket: true }, (socket) => {
    bridge.handleConnection(socket);
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  // Vite dev middleware or static files
  let viteServer: { close: () => Promise<void> } | undefined;

  if (dev) {
    // Dev mode: Vite as middleware via @fastify/middie
    const middie = await import('@fastify/middie');
    await app.register(middie.default);

    const vite = await import('vite');
    const server = await vite.createServer({
      configFile: path.resolve(projectRoot, 'src/web/vite.config.ts'),
      server: {
        middlewareMode: true,
        hmr: { port: 24678 }, // Separate port — avoids conflict with @fastify/websocket
      },
    });
    viteServer = server;

    // Use Vite's connect middleware — skip API/WS routes so Fastify handles them
    app.use((req: { url?: string }, _res: unknown, next: () => void) => {
      if (req.url === '/ws' || req.url === '/health') {
        next();
        return;
      }
      (server.middlewares as { handle: (req: unknown, res: unknown, next: () => void) => void }).handle(req, _res, next);
    });

    // SPA fallback via Vite (transforms index.html with HMR injection)
    app.setNotFoundHandler(async (req, reply) => {
      const indexPath = path.resolve(projectRoot, 'src/web/index.html');
      const rawHtml = fs.readFileSync(indexPath, 'utf-8');
      const html = await server.transformIndexHtml(req.url, rawHtml);
      return reply.type('text/html').send(html);
    });
  } else {
    // Prod mode: serve static files from dist/web
    const webDistDir = path.resolve(projectRoot, 'dist/web');
    await app.register(fastifyStatic, {
      root: webDistDir,
      prefix: '/',
      decorateReply: false,
    });

    // SPA fallback
    app.setNotFoundHandler((_req, reply) => {
      return reply.sendFile('index.html', webDistDir);
    });
  }

  // Start listening
  await app.listen({ host, port });

  const mode = dev ? 'dev' : 'prod';
  console.log(`Gateway (${mode}) listening on http://${host}:${port}`);
  if (dev) {
    console.log(`Vite HMR on ws://localhost:24678`);
  }

  // Graceful shutdown
  const close = async (): Promise<void> => {
    bridge.close();
    if (viteServer) {
      await viteServer.close();
    }
    await app.close();
  };

  return { app, bridge, agentLoop, eventBus, close };
}
