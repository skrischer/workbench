// src/runtime/create-runtime.ts — Factory for creating Agent Runtime

import { AgentLoop, type AgentLoopHooks } from './agent-loop.js';
import { createGitHooks, type GitHooksConfig } from './git-hooks.js';
import { TokenTracker } from './token-tracker.js';
import { RunLogger } from '../storage/run-logger.js';
import { TypedEventBus } from '../events/event-bus.js';
import type { AnthropicClient } from '../llm/anthropic-client.js';
import type { SessionStorage } from '../storage/session-storage.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { AgentConfig } from '../types/index.js';

/**
 * Configuration for runtime creation
 */
export interface RuntimeConfig {
  /** Anthropic client for LLM calls */
  anthropicClient: AnthropicClient;
  
  /** Session storage for conversation history */
  sessionStorage: SessionStorage;
  
  /** Tool registry */
  toolRegistry: ToolRegistry;
  
  /** Agent configuration */
  agentConfig: AgentConfig;
  
  /** Optional Git hooks configuration */
  gitHooks?: GitHooksConfig;
  
  /** Optional custom hooks (overrides gitHooks if provided) */
  customHooks?: AgentLoopHooks;
}

/**
 * Create a new Agent Runtime with Event Bus, TokenTracker, and optional Git integration
 * 
 * @param config - Runtime configuration
 * @returns Configured AgentLoop instance with attached helpers
 * 
 * @example
 * ```ts
 * const runtime = createRuntime({
 *   anthropicClient: client,
 *   sessionStorage: storage,
 *   toolRegistry: registry,
 *   agentConfig: config,
 *   gitHooks: {
 *     repoPath: '/path/to/repo',
 *     baseBranch: 'main',
 *     keepWorktree: false
 *   }
 * });
 * 
 * // Run the agent
 * const result = await runtime.run('Hello, world!');
 * 
 * // Access helpers
 * const eventBus = runtime.getEventBus();
 * const tokenTracker = runtime.getTokenTracker();
 * const runLogger = runtime.getRunLogger();
 * ```
 */
export function createRuntime(config: RuntimeConfig): AgentLoop {
  // Create Event Bus
  const eventBus = new TypedEventBus();

  // Create TokenTracker and subscribe to events
  const tokenTracker = new TokenTracker();
  eventBus.on('run:start', () => {
    tokenTracker.reset();
  });
  eventBus.on('llm:response', ({ tokenUsage }) => {
    tokenTracker.recordStep(tokenUsage);
  });

  // Create RunLogger and subscribe to events
  const runLogger = new RunLogger();
  eventBus.on('run:start', ({ runId, prompt }) => {
    runLogger.startRun(runId, prompt);
  });
  eventBus.on('run:step', ({ runId, stepIndex, message }) => {
    runLogger.logStep(runId, message, stepIndex);
  });
  eventBus.on('tool:call', ({ runId, toolName, input, stepIndex }) => {
    // Store tool call start time for duration calculation
    const startTime = performance.now();
    // We'll log the complete tool call in tool:result event
    eventBus.once('tool:result', ({ runId: resultRunId, toolName: resultToolName, result }) => {
      if (resultRunId === runId && resultToolName === toolName) {
        const durationMs = performance.now() - startTime;
        runLogger.logToolCall(
          runId,
          {
            toolName,
            input: input as Record<string, unknown>,
            output: result.output ?? result.error ?? '',
            durationMs,
          },
          stepIndex
        );
      }
    });
  });
  eventBus.on('run:end', async ({ runId, tokenUsage }) => {
    await runLogger.endRun(runId, 'completed', tokenUsage);
  });
  eventBus.on('run:error', async ({ runId }) => {
    await runLogger.endRun(runId, 'failed');
  });

  // Determine hooks
  let hooks: AgentLoopHooks | undefined;
  if (config.customHooks) {
    hooks = config.customHooks;
  } else if (config.gitHooks) {
    hooks = createGitHooks(config.gitHooks);
  }

  // Create AgentLoop
  const runtime = new AgentLoop(
    config.anthropicClient,
    config.sessionStorage,
    config.toolRegistry,
    config.agentConfig,
    eventBus,
    hooks
  );

  // Attach tokenTracker and runLogger to runtime for easy access
  // Using Object.defineProperty to avoid polluting the class with public properties
  Object.defineProperty(runtime, '_tokenTracker', { value: tokenTracker, writable: false });
  Object.defineProperty(runtime, '_runLogger', { value: runLogger, writable: false });

  return runtime;
}
