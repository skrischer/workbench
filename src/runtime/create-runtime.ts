// src/runtime/create-runtime.ts — Factory for creating Agent Runtime with Git Integration

import { AgentLoop, type RuntimeConfig } from './agent-loop.js';
import { DEFAULT_PROTECTED_BRANCHES } from '../git/index.js';

/**
 * Create a new Agent Runtime with Git integration
 * 
 * @param config - Runtime configuration
 * @returns Configured AgentLoop instance
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
 * // Finish and cleanup
 * await runtime.finish('run-123');
 * ```
 */
export function createRuntime(config: RuntimeConfig): AgentLoop {
  // Provide defaults
  const fullConfig: RuntimeConfig = {
    ...config,
    gitSafety: config.gitSafety ?? true, // Default to true, AgentLoop will disable if no .git
    keepWorktree: config.keepWorktree ?? false,
    protectedBranches: config.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES,
  };

  return new AgentLoop(fullConfig);
}
