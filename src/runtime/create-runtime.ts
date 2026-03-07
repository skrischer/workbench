// src/runtime/create-runtime.ts — Factory for creating Agent Runtime with Git Integration

import { AgentLoop, type RuntimeConfig } from './agent-loop.js';
import { TokenTracker } from './token-tracker.js';
import { RunLogger } from '../storage/run-logger.js';
import { TypedEventBus } from '../events/event-bus.js';
import { DEFAULT_PROTECTED_BRANCHES } from '../git/index.js';

/**
 * Create a new Agent Runtime with Git integration, Event Bus, TokenTracker, and RunLogger
 * 
 * @param config - Runtime configuration
 * @returns Configured AgentLoop instance (access eventBus, tokenTracker, runLogger via getters)
 * 
 * @example
 * ```ts
 * const runtime = createRuntime({
 *   repoPath: '/path/to/repo',
 *   gitSafety: true,
 *   keepWorktree: false
 * });
 * 
 * // Start a run
 * const { tools, worktreePath } = await runtime.start('run-123', undefined, myTools);
 * 
 * // After tool execution
 * await runtime.afterToolCall('write_file', 'run-123', 0);
 * 
 * // Get diff
 * const diff = await runtime.getDiff('run-123');
 * 
 * // Access event bus, token tracker, or run logger
 * const eventBus = runtime.getEventBus();
 * const tokenTracker = runtime.getTokenTracker();
 * const runLogger = runtime.getRunLogger();
 * 
 * // Finish and cleanup
 * await runtime.finish('run-123');
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

  // Provide defaults and inject event bus
  const fullConfig: RuntimeConfig = {
    ...config,
    gitSafety: config.gitSafety ?? true, // Default to true, AgentLoop will disable if no .git
    keepWorktree: config.keepWorktree ?? false,
    protectedBranches: config.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES,
    eventBus,
  };

  const runtime = new AgentLoop(fullConfig);

  // Attach tokenTracker and runLogger to runtime for easy access
  // Using Object.defineProperty to avoid polluting the class with public properties
  Object.defineProperty(runtime, '_tokenTracker', { value: tokenTracker, writable: false });
  Object.defineProperty(runtime, '_runLogger', { value: runLogger, writable: false });

  return runtime;
}
