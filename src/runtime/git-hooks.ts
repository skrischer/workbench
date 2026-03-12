// src/runtime/git-hooks.ts — Git-based Lifecycle Hooks for AgentLoop

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Session, RunResult, ToolResult } from '../types/index.js';
import type { AgentLoopHooks } from './agent-loop.js';
import {
  WorktreeManager,
  AutoCommitter,
  diff,
  getCurrentBranch,
  type CreateWorktreeResult,
} from '../git/index.js';

/**
 * Configuration for Git-based hooks
 */
export interface GitHooksConfig {
  /** Path to the git repository */
  repoPath: string;
  
  /** Base branch to branch off from (default: 'HEAD') */
  baseBranch?: string;
  
  /** Keep worktree after run finishes (default: false) */
  keepWorktree?: boolean;
  
  /** Protected branch patterns (default: ['main', 'master', 'develop', ...]) */
  protectedBranches?: string[];
  
  /** Base directory for worktrees (optional) */
  worktreeBaseDir?: string;
  
  /** Enable git safety features (default: true if .git exists) */
  enabled?: boolean;
}

/**
 * State for active Git-integrated runs
 */
interface GitRunState {
  worktree: CreateWorktreeResult;
  baseBranch: string;
}

/**
 * Create Git-based lifecycle hooks for AgentLoop
 * 
 * Provides worktree management and auto-commit functionality:
 * - onBeforeRun: Creates isolated worktree for the run
 * - onAfterStep: Auto-commits changes after tool execution
 * - onAfterRun: Cleans up worktree after run completion
 * 
 * @param config - Git hooks configuration
 * @returns AgentLoopHooks instance
 * 
 * @example
 * ```typescript
 * const hooks = createGitHooks({
 *   repoPath: '/path/to/repo',
 *   baseBranch: 'main',
 *   keepWorktree: false
 * });
 * 
 * const loop = new AgentLoop(client, storage, registry, config, eventBus, hooks);
 * ```
 */
export function createGitHooks(config: GitHooksConfig): AgentLoopHooks {
  // State management
  const activeRuns = new Map<string, GitRunState>();
  const worktreeManager = new WorktreeManager(config.worktreeBaseDir);
  const autoCommitter = new AutoCommitter();
  
  // Track step counters per run
  const stepCounters = new Map<string, number>();

  // Determine if git should be enabled
  const gitEnabled = shouldEnableGit(config);

  if (!gitEnabled) {
    console.warn('[GitHooks] Git features disabled - .git directory not found or explicitly disabled');
    // Return no-op hooks
    return {};
  }

  return {
    /**
     * Initialize worktree before run starts
     */
    async onBeforeRun(session: Session): Promise<void> {
      const runId = session.id;
      
      // Resolve base branch
      let baseBranch = config.baseBranch || 'HEAD';
      if (baseBranch === 'HEAD') {
        const branchResult = getCurrentBranch(config.repoPath);
        if (branchResult.success && branchResult.data) {
          baseBranch = branchResult.data;
        }
      }

      // Create worktree
      const worktreeResult = worktreeManager.createForRun(runId, config.repoPath, baseBranch);

      if (!worktreeResult.success) {
        throw new Error(`Failed to create worktree: ${worktreeResult.error}`);
      }

      const worktree = worktreeResult.data!;

      // Store run state
      activeRuns.set(runId, {
        worktree,
        baseBranch,
      });

      // Initialize step counter
      stepCounters.set(runId, 0);

      console.log(`[GitHooks] Created worktree for run ${runId}: ${worktree.worktreePath}`);
    },

    /**
     * Auto-commit changes after tool execution
     */
    async onAfterStep(
      step: ToolResult,
      context: { runId: string; stepIndex: number; toolName: string }
    ): Promise<void> {
      const runState = activeRuns.get(context.runId);
      if (!runState) {
        return; // No worktree, skip
      }

      // Only commit if tool execution was successful
      if (!step.success) {
        return;
      }

      // Create auto-commit
      const commitResult = await autoCommitter.commitAfterTool(
        context.toolName,
        context.runId,
        context.stepIndex,
        runState.worktree.worktreePath
      );

      if (!commitResult.success) {
        console.warn(`[GitHooks] Failed to auto-commit after ${context.toolName}:`, commitResult.error);
      } else if (commitResult.data) {
        console.log(`[GitHooks] Auto-committed after ${context.toolName}: ${commitResult.data}`);
      }
    },

    /**
     * Cleanup worktree and optionally get diff
     */
    async onAfterRun(result: RunResult, context: { runId: string }): Promise<void> {
      const runState = activeRuns.get(context.runId);
      if (!runState) {
        return; // No worktree, nothing to cleanup
      }

      // Get diff before cleanup (optional - for logging/debugging)
      try {
        const diffResult = diff(
          runState.baseBranch,
          undefined,
          runState.worktree.worktreePath
        );
        
        if (diffResult.success && diffResult.data) {
          console.log(`[GitHooks] Diff for run ${context.runId}:\n${diffResult.data}`);
        }
      } catch (error) {
        console.warn('[GitHooks] Failed to get diff:', error);
      }

      // Remove from active runs
      activeRuns.delete(context.runId);
      stepCounters.delete(context.runId);

      // If keepWorktree is true, don't remove
      if (config.keepWorktree) {
        console.log(`[GitHooks] Keeping worktree for run ${context.runId}: ${runState.worktree.worktreePath}`);
        return;
      }

      // Cleanup worktree
      const cleanupResult = worktreeManager.cleanup(context.runId, {
        deleteBranch: false, // Keep branch for now, can be configurable later
      });

      if (!cleanupResult.success) {
        console.warn(`[GitHooks] Failed to cleanup worktree: ${cleanupResult.error}`);
      } else {
        console.log(`[GitHooks] Cleaned up worktree for run ${context.runId}`);
      }
    },
  };
}

/**
 * Check if git safety should be enabled
 */
function shouldEnableGit(config: GitHooksConfig): boolean {
  // If explicitly disabled, respect that
  if (config.enabled === false) {
    return false;
  }

  // If explicitly enabled but no .git directory, disable gracefully
  const gitDir = resolve(config.repoPath, '.git');
  if (!existsSync(gitDir)) {
    if (config.enabled === true) {
      console.warn(
        `[GitHooks] Git safety requested but .git not found at ${gitDir}. Disabling git features.`
      );
    }
    return false;
  }

  // Default: enable if .git exists
  return true;
}
