// src/cli/run-command.ts — CLI run command implementation

import { homedir } from 'node:os';
import path from 'node:path';
import { loadAgentConfig } from '../agent/config.js';
import { AnthropicClient } from '../llm/anthropic-client.js';
import { TokenRefresher } from '../llm/token-refresh.js';
import { TokenStorage } from '../llm/token-storage.js';
import { AgentLoop } from '../runtime/agent-loop.js';
import { SessionStorage } from '../storage/session-storage.js';
import { createDefaultTools } from '../tools/defaults.js';
import { ToolRegistry } from '../tools/registry.js';
import { BaseTool } from '../tools/base.js';
import type { AgentConfig, ToolResult } from '../types/index.js';

/**
 * CLI run command options
 */
export interface RunCommandOptions {
  model?: string;
  maxSteps?: number;
  config?: string;
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
    // 1. Load agent config (with CLI overrides)
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to load agent config: ${message}`);
      process.exit(1);
    }

    // 2. Create TokenStorage (default path: ~/.workbench/tokens.json)
    const tokenPath = path.join(homedir(), '.workbench', 'tokens.json');
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
    });

    // 5. Create ToolRegistry with default tools (wrapped with logging)
    const baseRegistry = createDefaultTools();
    const toolRegistry = new LoggingToolRegistry(baseRegistry);

    // 6. Create SessionStorage
    const sessionStorage = new SessionStorage();

    // 7. Create AgentLoop
    const agentLoop = new AgentLoop(
      anthropicClient,
      sessionStorage,
      toolRegistry,
      agentConfig
    );

    // 8. Run agent loop
    console.error(`🚀 Starting agent with prompt: "${prompt}"`);
    console.error(`📋 Model: ${agentConfig.model}`);
    console.error(`🔧 Max steps: ${agentConfig.maxSteps}`);
    console.error('');

    const result = await agentLoop.run(prompt);

    // 9. Output results
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
