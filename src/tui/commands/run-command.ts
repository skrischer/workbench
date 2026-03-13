// src/tui/commands/run-command.ts — Non-interactive run command (Gateway client with local fallback)

import type { WsEventMessage } from '../../types/ws-protocol.js';
import type { EventMap } from '../../types/events.js';

export interface RunCommandOptions {
  model?: string;
  maxSteps?: number;
  config?: string;
  noSummarize?: boolean;
}

export async function runCommand(prompt: string, options: RunCommandOptions): Promise<void> {
  try {
    // Try Gateway-based execution first
    const { isGatewayReachable } = await import('../../gateway/health.js');
    const reachable = await isGatewayReachable();

    if (reachable) {
      await runViaGateway(prompt);
    } else {
      await runLocally(prompt, options);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unexpected error: ${message}`);
    if (error instanceof Error && error.stack) console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Run via Gateway WebSocket — lightweight, no local dependencies needed.
 */
async function runViaGateway(prompt: string): Promise<void> {
  const { connectToGateway } = await import('../../gateway/client.js');
  const client = await connectToGateway();

  const session = await client.sendCommand('create_session') as { id: string };
  const sessionId = session.id;

  let finalResponse = '';
  let runFailed = false;
  let errorMessage = '';
  let steps = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  const runDone = new Promise<void>((resolve) => {
    client.onEvent((msg: WsEventMessage) => {
      switch (msg.event) {
        case 'llm:stream:delta': {
          const data = msg.data as EventMap['llm:stream:delta'];
          process.stdout.write(data.text);
          finalResponse += data.text;
          break;
        }
        case 'tool:call': {
          const data = msg.data as EventMap['tool:call'];
          console.error(`[tool] ${data.toolName}: ${JSON.stringify(data.input)}`);
          break;
        }
        case 'run:step': {
          steps++;
          break;
        }
        case 'llm:response': {
          const data = msg.data as EventMap['llm:response'];
          inputTokens += data.tokenUsage.inputTokens;
          outputTokens += data.tokenUsage.outputTokens;
          break;
        }
        case 'run:end': {
          resolve();
          break;
        }
        case 'run:error': {
          const data = msg.data as EventMap['run:error'];
          runFailed = true;
          errorMessage = data.error;
          resolve();
          break;
        }
        case 'llm:stream:stop': {
          finalResponse = '';
          break;
        }
        case 'session:message': {
          const data = msg.data as EventMap['session:message'];
          if (data.message.role === 'assistant') {
            finalResponse = data.message.content;
          }
          break;
        }
        default:
          break;
      }
    });
  });

  console.error(`Starting agent with prompt: "${prompt}" (via Gateway)`);
  console.error(`Session: ${sessionId}`);
  console.error('');

  await client.sendCommand('send_message', { sessionId, prompt });
  await runDone;

  if (finalResponse && !finalResponse.endsWith('\n')) {
    process.stdout.write('\n');
  }

  console.error('');
  console.error(`Status: ${runFailed ? 'failed' : 'completed'}`);
  console.error(`Steps: ${steps}`);
  console.error(`Session ID: ${sessionId}`);
  console.error(`Token usage: ${inputTokens} in / ${outputTokens} out`);

  client.close();

  if (runFailed) {
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  } else {
    process.exit(0);
  }
}

/**
 * Run locally with full AgentLoop — fallback when Gateway is not available.
 */
async function runLocally(prompt: string, options: RunCommandOptions): Promise<void> {
  const { homedir } = await import('node:os');
  const path = await import('node:path');
  const { loadAgentConfig } = await import('../../agent/config.js');
  const { AnthropicClient } = await import('../../llm/anthropic-client.js');
  const { TokenRefresher } = await import('../../llm/token-refresh.js');
  const { TokenStorage } = await import('../../llm/token-storage.js');
  const { AgentLoop } = await import('../../runtime/agent-loop.js');
  const { SessionStorage } = await import('../../storage/session-storage.js');
  const { RunLogger } = await import('../../storage/run-logger.js');
  const { createDefaultTools } = await import('../../tools/defaults.js');
  const { ToolRegistry } = await import('../../tools/registry.js');
  const { BaseTool } = await import('../../tools/base.js');
  const { loadUserConfig } = await import('../../config/user-config.js');
  const { LanceDBMemoryStore } = await import('../../memory/lancedb-store.js');
  const { createAutoMemoryHook } = await import('../../memory/auto-memory.js');
  const { AgentRegistry } = await import('../../multi-agent/agent-registry.js');
  const { MessageBus } = await import('../../multi-agent/message-bus.js');
  const { AgentOrchestrator } = await import('../../multi-agent/orchestrator.js');

  type AgentConfig = import('../../types/index.js').AgentConfig;
  type ToolResult = import('../../types/index.js').ToolResult;
  type Session = import('../../types/index.js').Session;
  type RunResult = import('../../types/index.js').RunResult;
  type AgentLoopHooks = import('../../runtime/agent-loop.js').AgentLoopHooks;

  // LoggingToolWrapper for stderr tool-call logging
  type BaseToolInstance = InstanceType<typeof BaseTool>;
  type ToolRegistryInstance = InstanceType<typeof ToolRegistry>;

  class LoggingToolWrapper extends BaseTool {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: Record<string, unknown>;

    constructor(private tool: BaseToolInstance) {
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
    private wrappedTools = new Map<string, BaseToolInstance>();

    constructor(private baseRegistry: ToolRegistryInstance) {
      super();
    }

    override register(tool: BaseToolInstance): void {
      this.baseRegistry.register(tool);
    }

    override get(name: string): BaseToolInstance | undefined {
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

  let tokenRefresher: InstanceType<typeof TokenRefresher>;
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
}
