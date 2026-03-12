// src/tui/commands/run-command.ts — Non-interactive run command (migrated from src/cli/)

import { homedir } from 'node:os';
import path from 'node:path';
import { loadAgentConfig } from '../../agent/config.js';
import { AnthropicClient } from '../../llm/anthropic-client.js';
import { TokenRefresher } from '../../llm/token-refresh.js';
import { TokenStorage } from '../../llm/token-storage.js';
import { AgentLoop } from '../../runtime/agent-loop.js';
import { SessionStorage } from '../../storage/session-storage.js';
import { RunLogger } from '../../storage/run-logger.js';
import { createDefaultTools } from '../../tools/defaults.js';
import { ToolRegistry } from '../../tools/registry.js';
import { BaseTool } from '../../tools/base.js';
import type { AgentConfig, ToolResult, Session, RunResult } from '../../types/index.js';
import type { AgentLoopHooks } from '../../runtime/agent-loop.js';
import { loadUserConfig } from '../../config/user-config.js';
import { LanceDBMemoryStore } from '../../memory/lancedb-store.js';
import { createAutoMemoryHook } from '../../memory/auto-memory.js';
import { AgentRegistry } from '../../multi-agent/agent-registry.js';
import { MessageBus } from '../../multi-agent/message-bus.js';
import { AgentOrchestrator } from '../../multi-agent/orchestrator.js';

export interface RunCommandOptions {
  model?: string;
  maxSteps?: number;
  config?: string;
  noSummarize?: boolean;
}

class LoggingToolWrapper extends BaseTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;

  constructor(private tool: BaseTool) {
    super();
    this.name = tool.name;
    this.description = tool.description;
    this.inputSchema = tool.inputSchema;
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    console.error(`[tool] ${this.name}: ${JSON.stringify(input)}`);
    return await this.tool.execute(input);
  }
}

class LoggingToolRegistry extends ToolRegistry {
  private wrappedTools = new Map<string, BaseTool>();

  constructor(private baseRegistry: ToolRegistry) {
    super();
  }

  override register(tool: BaseTool): void {
    this.baseRegistry.register(tool);
  }

  override get(name: string): BaseTool | undefined {
    if (this.wrappedTools.has(name)) {
      return this.wrappedTools.get(name);
    }
    const originalTool = this.baseRegistry.get(name);
    if (!originalTool) return undefined;
    const wrappedTool = new LoggingToolWrapper(originalTool);
    this.wrappedTools.set(name, wrappedTool);
    return wrappedTool;
  }

  override has(name: string): boolean {
    return this.baseRegistry.has(name);
  }

  override list(): string[] {
    return this.baseRegistry.list();
  }
}

export async function runCommand(prompt: string, options: RunCommandOptions): Promise<void> {
  try {
    const agentRegistry = new AgentRegistry();
    const messageBus = new MessageBus();
    const baseRegistry = createDefaultTools({ agentRegistry, messageBus });

    let agentConfig: AgentConfig;
    try {
      agentConfig = await loadAgentConfig(options.config);
      if (options.model) agentConfig.model = options.model;
      if (options.maxSteps !== undefined) agentConfig.maxSteps = options.maxSteps;
      if (!agentConfig.tools || agentConfig.tools.length === 0) {
        agentConfig.tools = baseRegistry.list();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to load agent config: ${message}`);
      process.exit(1);
    }

    const workbenchHome = process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
    const tokenPath = path.join(workbenchHome, 'tokens.json');
    const tokenStorage = new TokenStorage(tokenPath);

    let tokenRefresher: TokenRefresher;
    try {
      tokenRefresher = new TokenRefresher(tokenStorage);
      await tokenStorage.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Token error: ${message}`);
      console.error('Setup required: run "workbench auth"');
      process.exit(1);
    }

    const anthropicClient = new AnthropicClient(tokenRefresher, {
      model: agentConfig.model,
      apiUrl: process.env.ANTHROPIC_API_URL,
    });

    const toolRegistry = new LoggingToolRegistry(baseRegistry);
    const sessionStorage = new SessionStorage();
    const userConfig = await loadUserConfig();

    const memoryStore = new LanceDBMemoryStore({
      dbPath: path.join(workbenchHome, 'memory'),
    });

    const { RememberTool } = await import('../../tools/remember.js');
    const { RecallTool } = await import('../../tools/recall.js');
    baseRegistry.register(new RememberTool(memoryStore));
    baseRegistry.register(new RecallTool(memoryStore));

    const orchestrator = new AgentOrchestrator(
      agentRegistry, messageBus, anthropicClient, sessionStorage, baseRegistry
    );

    const runLogger = new RunLogger(workbenchHome);

    const autoMemoryHook = createAutoMemoryHook({
      sessionStorage, runLogger, memoryStore, userConfig,
      noSummarize: options.noSummarize,
    });

    const hooks: AgentLoopHooks = {
      onBeforeRun: async (session: Session) => {
        runLogger.startRun(session.id, prompt);
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
      anthropicClient, sessionStorage, toolRegistry, agentConfig,
      undefined, hooks, undefined, agentRegistry, orchestrator
    );

    console.error(`Starting agent with prompt: "${prompt}"`);
    console.error(`Model: ${agentConfig.model}`);
    console.error(`Max steps: ${agentConfig.maxSteps}`);
    console.error('');

    const result = await agentLoop.run(prompt);

    console.log(result.finalResponse);
    console.error('');
    console.error(`Status: ${result.status}`);
    console.error(`Steps: ${result.steps}`);
    console.error(`Session ID: ${result.sessionId}`);
    console.error(`Token usage: ${result.tokenUsage.input_tokens} in / ${result.tokenUsage.output_tokens} out`);

    if (result.status === 'failed') {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unexpected error: ${message}`);
    if (error instanceof Error && error.stack) console.error(error.stack);
    process.exit(1);
  }
}
