// src/runtime/agent-loop.ts — Agent Runtime Loop with Git Integration

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tool, ToolResult } from '../types/index.js';
import type { TypedEventBus } from '../events/event-bus.js';
import type { TokenTracker } from './token-tracker.js';
import type { RunLogger } from '../storage/run-logger.js';
import {
  WorktreeManager,
  AutoCommitter,
  wrapTool,
  diff,
  type CreateWorktreeResult,
} from '../git/index.js';

/**
 * Configuration for the Agent Runtime
 */
export interface RuntimeConfig {
  /** Path to the git repository */
  repoPath: string;
  /** Enable git safety features (default: true if .git exists) */
  gitSafety?: boolean;
  /** Keep worktree after run finishes (default: false) */
  keepWorktree?: boolean;
  /** Protected branch patterns (default: ['main', 'master', 'develop', ...]) */
  protectedBranches?: string[];
  /** Base directory for worktrees (optional) */
  worktreeBaseDir?: string;
  /** Event bus for runtime events (optional) */
  eventBus?: TypedEventBus;
}

/**
 * Runtime state for a run
 */
interface RunState {
  runId: string;
  worktree?: CreateWorktreeResult;
  baseBranch: string;
}

/**
 * AgentLoop - Manages the runtime loop for agent execution with Git integration
 */
export class AgentLoop {
  private config: RuntimeConfig;
  private worktreeManager: WorktreeManager;
  private autoCommitter: AutoCommitter;
  private activeRuns: Map<string, RunState> = new Map();
  private gitEnabled: boolean;
  private eventBus?: TypedEventBus;

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.eventBus = config.eventBus;
    this.worktreeManager = new WorktreeManager(config.worktreeBaseDir);
    this.autoCommitter = new AutoCommitter();

    // Determine if git safety should be enabled
    this.gitEnabled = this.shouldEnableGit();
  }

  /**
   * Check if git safety should be enabled
   */
  private shouldEnableGit(): boolean {
    // If explicitly disabled, respect that
    if (this.config.gitSafety === false) {
      return false;
    }

    // If explicitly enabled but no .git directory, disable gracefully
    const gitDir = resolve(this.config.repoPath, '.git');
    if (!existsSync(gitDir)) {
      if (this.config.gitSafety === true) {
        console.warn(
          `[AgentLoop] Git safety requested but .git not found at ${gitDir}. Disabling git features.`
        );
      }
      return false;
    }

    // Default: enable if .git exists
    return true;
  }

  /**
   * Start a new run with git integration
   * @param runId - Unique run identifier
   * @param repoPath - Path to repository (overrides config if provided)
   * @param tools - Array of tools to wrap with branch guards
   * @param options - Additional options
   * @returns Wrapped tools and worktree info
   */
  async start(
    runId: string,
    repoPath?: string,
    tools: Tool[] = [],
    options?: { baseBranch?: string }
  ): Promise<{
    tools: Tool[];
    worktreePath?: string;
    branchName?: string;
  }> {
    const actualRepoPath = repoPath || this.config.repoPath;
    let baseBranch = options?.baseBranch || 'HEAD';

    // Resolve HEAD to actual branch name if needed
    if (this.gitEnabled && baseBranch === 'HEAD') {
      const { getCurrentBranch } = await import('../git/index.js');
      const branchResult = getCurrentBranch(actualRepoPath);
      if (branchResult.success && branchResult.data) {
        baseBranch = branchResult.data;
      }
    }

    // If git is disabled, return tools as-is
    if (!this.gitEnabled) {
      this.activeRuns.set(runId, { runId, baseBranch });
      return { tools };
    }

    // Create worktree
    const worktreeResult = this.worktreeManager.createForRun(runId, actualRepoPath, baseBranch);

    if (!worktreeResult.success) {
      throw new Error(`Failed to create worktree: ${worktreeResult.error}`);
    }

    const worktree = worktreeResult.data!;

    // Store run state
    this.activeRuns.set(runId, {
      runId,
      worktree,
      baseBranch,
    });

    // Wrap tools with branch guards (pass worktree path as cwd)
    const wrappedTools = tools.map((tool) =>
      wrapTool(tool, {
        enabled: true,
        protectedBranches: this.config.protectedBranches,
        cwd: worktree.worktreePath,
      })
    );

    return {
      tools: wrappedTools,
      worktreePath: worktree.worktreePath,
      branchName: worktree.branchName,
    };
  }

  /**
   * Hook to call after a tool execution - creates auto-commit
   * @param toolName - Name of the tool that was executed
   * @param runId - Run identifier
   * @param stepIndex - Step index in the run
   * @returns Commit hash or null if no changes
   */
  async afterToolCall(toolName: string, runId: string, stepIndex: number): Promise<string | null> {
    // If git is disabled, skip
    if (!this.gitEnabled) {
      return null;
    }

    const runState = this.activeRuns.get(runId);
    if (!runState) {
      throw new Error(`No active run found for runId: ${runId}`);
    }

    // If no worktree, skip
    if (!runState.worktree) {
      return null;
    }

    // Create auto-commit
    const commitResult = await this.autoCommitter.commitAfterTool(
      toolName,
      runId,
      stepIndex,
      runState.worktree.worktreePath
    );

    if (!commitResult.success) {
      throw new Error(`Failed to auto-commit: ${commitResult.error}`);
    }

    return commitResult.data || null;
  }

  /**
   * Get diff between agent branch and base branch
   * @param runId - Run identifier
   * @returns Diff output or empty string
   */
  async getDiff(runId: string): Promise<string> {
    // If git is disabled, return empty
    if (!this.gitEnabled) {
      return '';
    }

    const runState = this.activeRuns.get(runId);
    if (!runState) {
      throw new Error(`No active run found for runId: ${runId}`);
    }

    // If no worktree, return empty
    if (!runState.worktree) {
      return '';
    }

    // Get diff (from base branch to current HEAD in worktree)
    // When in worktree, HEAD points to agent branch, so we only pass baseBranch
    const diffResult = diff(
      runState.baseBranch,
      undefined,
      runState.worktree.worktreePath
    );

    if (!diffResult.success) {
      throw new Error(`Failed to get diff: ${diffResult.error}`);
    }

    return diffResult.data || '';
  }

  /**
   * Finish a run and cleanup
   * @param runId - Run identifier
   * @returns Cleanup result
   */
  async finish(runId: string): Promise<{ removed: boolean; path?: string }> {
    const runState = this.activeRuns.get(runId);
    if (!runState) {
      return { removed: false };
    }

    // Remove from active runs
    this.activeRuns.delete(runId);

    // If git is disabled or no worktree, nothing to cleanup
    if (!this.gitEnabled || !runState.worktree) {
      return { removed: false };
    }

    // If keepWorktree is true, don't remove
    if (this.config.keepWorktree) {
      return { removed: false, path: runState.worktree.worktreePath };
    }

    // Cleanup worktree
    const cleanupResult = this.worktreeManager.cleanup(runId, {
      deleteBranch: false, // Keep branch for now, can be configurable later
    });

    if (!cleanupResult.success) {
      console.warn(`[AgentLoop] Failed to cleanup worktree: ${cleanupResult.error}`);
      return { removed: false };
    }

    return { removed: true, path: cleanupResult.data };
  }

  /**
   * Check if git safety is enabled
   */
  isGitEnabled(): boolean {
    return this.gitEnabled;
  }

  /**
   * Get active run state
   */
  getRunState(runId: string): RunState | undefined {
    return this.activeRuns.get(runId);
  }

  /**
   * Get all active run IDs
   */
  getActiveRunIds(): string[] {
    return Array.from(this.activeRuns.keys());
  }

  /**
   * Get the event bus instance
   */
  getEventBus(): TypedEventBus | undefined {
    return this.eventBus;
  }

  /**
   * Get the token tracker instance (attached by createRuntime)
   */
  getTokenTracker(): TokenTracker | undefined {
    return (this as any)._tokenTracker;
  }

  /**
   * Get the run logger instance (attached by createRuntime)
   */
  getRunLogger(): RunLogger | undefined {
    return (this as any)._runLogger;
  }
}
