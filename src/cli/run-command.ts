// src/cli/run-command.ts — CLI run command implementation

import { homedir } from 'node:os';
import path from 'node:path';
import { loadAgentConfig } from '../agent/config.js';
import { AnthropicClient } from '../llm/anthropic-client.js';
import { TokenRefresher } from '../llm/token-refresh.js';
import { TokenStorage } from '../llm/token-storage.js';
import { CoreAgentLoop } from '../runtime/core-agent-loop.js';
import { SessionStorage } from '../storage/session-storage.js';
import { RunLogger } from '../storage/run-logger.js';
import { createDefaultTools } from '../tools/defaults.js';
import { ToolRegistry } from '../tools/registry.js';
import { BaseTool } from '../tools/base.js';
import type { AgentConfig, ToolResult, Session, RunResult } from '../types/index.js';
import type { AgentLoopHooks } from '../runtime/agent-loop.js';
import { loadUserConfig } from '../config/user-config.js';
import { LanceDBMemoryStore } from '../memory/lancedb-store.js';
import { createAutoMemoryHook } from '../memory/auto-memory.js';
import { AgentRegistry } from '../multi-agent/agent-registry.js';
import { MessageBus } from '../multi-agent/message-bus.js';

/**
 * CLI run command options
 */
export interface RunCommandOptions {
  model?: string;
  maxSteps?: number;
  config?: string;
  noSummarize?: boolean;
}

/**
 * Logging wrapper for BaseTool to log calls to stderr
 */
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
    // Log tool call to stderr
    console.error(`[tool] ${this.name}: ${JSON.stringify(input)}`);
    
    // Execute the actual tool
    return await this.tool.execute(input);
  }
}

/**
 * Logging wrapper for ToolRegistry to log all tool calls
 * Wraps tools on-demand when they are retrieved via get()
 */
class LoggingToolRegistry extends ToolRegistry {
  private wrappedTools = new Map<string, BaseTool>();

  constructor(private baseRegistry: ToolRegistry) {
    super();
  }

  override register(tool: BaseTool): void {
    this.baseRegistry.register(tool);
  }

  override get(name: string): BaseTool | undefined {
    // Check if we already have a wrapped version
    if (this.wrappedTools.has(name)) {
      return this.wrappedTools.get(name);
    }

    // Get original tool from base registry
    const originalTool = this.baseRegistry.get(name);
    if (!originalTool) {
      return undefined;
    }

    // Wrap it and cache
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

/**
 * Execute the 'run' command
 * @param prompt - User prompt to process
 * @param options - CLI options (model, maxSteps, config path)
 */
export async function runCommand(prompt: string, options: RunCommandOptions): Promise<void> {
  try {
    // 1. Create multi-agent infrastructure (needed for default tools)
    const agentRegistry = new AgentRegistry();
    const messageBus = new MessageBus();
    
    // 2. Create ToolRegistry early (needed for config validation)
    // Note: memoryStore is added later after workbenchHome is configured
    const baseRegistry = createDefaultTools({
      agentRegistry,
      messageBus,
    });
    
    // 2. Load agent config (with CLI overrides)
    let agentConfig: AgentConfig;
    try {
      agentConfig = await loadAgentConfig(options.config);
      
      // Apply CLI flag overrides
      if (options.model) {
        agentConfig.model = options.model;
      }
      if (options.maxSteps !== undefined) {
        agentConfig.maxSteps = options.maxSteps;
      }
      
      // ✅ CRITICAL: Ensure tools are populated
      if (!agentConfig.tools || agentConfig.tools.length === 0) {
        agentConfig.tools = baseRegistry.list();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to load agent config: ${message}`);
      process.exit(1);
    }

    // 3. Create TokenStorage (default path: ~/.workbench/tokens.json)
    const workbenchHome = process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
    const tokenPath = path.join(workbenchHome, 'tokens.json');
    const tokenStorage = new TokenStorage(tokenPath);

    // 3. Create TokenRefresher
    let tokenRefresher: TokenRefresher;
    try {
      tokenRefresher = new TokenRefresher(tokenStorage);
      // Verify token file exists by attempting to load
      await tokenStorage.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Token error: ${message}`);
      console.error('');
      console.error('💡 Setup required:');
      console.error('   1. Create ~/.workbench directory');
      console.error('   2. Authorize via OAuth and save tokens to ~/.workbench/tokens.json');
      console.error('');
      process.exit(1);
    }

    // 4. Create AnthropicClient
    const anthropicClient = new AnthropicClient(tokenRefresher, {
      model: agentConfig.model,
      apiUrl: process.env.ANTHROPIC_API_URL,
    });

    // 5. Create LoggingToolRegistry wrapper (baseRegistry already created above)
    const toolRegistry = new LoggingToolRegistry(baseRegistry);

    // 6. Create SessionStorage
    const sessionStorage = new SessionStorage();

    // 6.5. Load UserConfig for auto-summarization
    const userConfig = await loadUserConfig();

    // 6.6. Create LanceDBMemoryStore for auto-memory
    const memoryStore = new LanceDBMemoryStore({
      dbPath: path.join(workbenchHome, 'memory'),
    });
    
    // 6.7. Register memory tools now that store is available
    const { RememberTool } = await import('../tools/remember.js');
    const { RecallTool } = await import('../tools/recall.js');
    baseRegistry.register(new RememberTool(memoryStore));
    baseRegistry.register(new RecallTool(memoryStore));

    // 7. Create RunLogger and define hooks
    const runLogger = new RunLogger(workbenchHome);
    let currentStepIndex = 0;
    
    // Create auto-memory hook
    const autoMemoryHook = createAutoMemoryHook({
      sessionStorage,
      runLogger,
      memoryStore,
      userConfig,
      noSummarize: options.noSummarize,
    });

    const hooks: AgentLoopHooks = {
      onBeforeRun: async (session: Session) => {
        runLogger.startRun(session.id, prompt);
      },
      
      onAfterStep: async (result: ToolResult, context: { runId: string; stepIndex: number; toolName: string }) => {
        currentStepIndex = context.stepIndex;
        
        // Log the tool call
        runLogger.logToolCall(
          context.runId,
          {
            toolName: context.toolName,
            input: {}, // Input was already logged by LoggingToolWrapper
            output: result.output,
            durationMs: 0, // Duration is tracked by event bus, not available here
          },
          context.stepIndex
        );
      },
      
      onAfterRun: async (result: RunResult, context: { runId: string }) => {
        // 1. Complete run logging
        const status: 'completed' | 'failed' | 'cancelled' = 
          result.status === 'failed' ? 'failed' : 'completed';
        
        const tokenUsage = {
          inputTokens: result.tokenUsage.input_tokens,
          outputTokens: result.tokenUsage.output_tokens,
          totalTokens: result.tokenUsage.input_tokens + result.tokenUsage.output_tokens,
        };
        
        await runLogger.endRun(context.runId, status, tokenUsage);
        
        // 2. Auto-memory storage (if enabled)
        if (autoMemoryHook) {
          await autoMemoryHook(result, context);
        }
      },
    };

    // 8. Create CoreAgentLoop with hooks
    const agentLoop = new CoreAgentLoop(
      anthropicClient,
      sessionStorage,
      toolRegistry,
      agentConfig,
      undefined, // eventBus
      hooks
    );

    // 9. Run agent loop
    console.error(`🚀 Starting agent with prompt: "${prompt}"`);
    console.error(`📋 Model: ${agentConfig.model}`);
    console.error(`🔧 Max steps: ${agentConfig.maxSteps}`);
    console.error('');

    const result = await agentLoop.run(prompt);

    // 10. Output results
    // Final response goes to stdout (for programmatic use)
    console.log(result.finalResponse);

    // Metadata goes to stderr (for human readability)
    console.error('');
    console.error('─────────────────────────────────────────');
    console.error(`✅ Status: ${result.status}`);
    console.error(`📊 Steps: ${result.steps}`);
    console.error(`🎯 Session ID: ${result.sessionId}`);
    console.error(`💰 Token usage: ${result.tokenUsage.input_tokens} in / ${result.tokenUsage.output_tokens} out`);
    console.error('─────────────────────────────────────────');

    // Exit with appropriate code
    if (result.status === 'failed') {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Unexpected error: ${message}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
