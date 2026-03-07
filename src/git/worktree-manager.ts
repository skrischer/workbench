// src/git/worktree-manager.ts — Worktree Management für Agent Runs

import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { existsSync, statSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import {
  createBranch,
  createWorktree,
  removeWorktree,
  listWorktrees,
  type GitResult,
  type WorktreeInfo,
} from './git-utils.js';

/**
 * Options for cleanup operation
 */
export interface CleanupOptions {
  /** Also delete the branch */
  deleteBranch?: boolean;
  /** Force cleanup even if worktree has uncommitted changes */
  force?: boolean;
}

/**
 * Active worktree information with metadata
 */
export interface ActiveWorktree extends WorktreeInfo {
  runId: string;
  createdAt: Date;
  isStale: boolean;
}

/**
 * Result of worktree creation
 */
export interface CreateWorktreeResult {
  worktreePath: string;
  branchName: string;
}

/**
 * WorktreeManager — manages isolated git worktrees for agent runs
 */
export class WorktreeManager {
  private baseDir: string;

  /**
   * Create a new WorktreeManager
   * @param baseDir - Base directory for worktrees (defaults to ~/.workbench/worktrees)
   */
  constructor(baseDir?: string) {
    this.baseDir = baseDir || join(homedir(), '.workbench', 'worktrees');
  }

  /**
   * Create a worktree for a run
   * @param runId - Unique run identifier
   * @param repoPath - Path to the main git repository
   * @param baseBranch - Optional base branch (defaults to current HEAD)
   * @returns GitResult with worktree path and branch name
   */
  createForRun(
    runId: string,
    repoPath: string,
    baseBranch?: string
  ): GitResult<CreateWorktreeResult> {
    const branchName = `agent/run-${runId}`;
    const worktreePath = this.getWorktreePath(runId);

    // Ensure base directory exists
    try {
      mkdirSync(this.baseDir, { recursive: true });
    } catch (error) {
      return {
        success: false,
        error: `Failed to create base directory: ${(error as Error).message}`,
      };
    }

    // Create branch
    const branchResult = createBranch(branchName, baseBranch, repoPath);
    if (!branchResult.success) {
      return {
        success: false,
        error: `Failed to create branch: ${branchResult.error}`,
      };
    }

    // Create worktree
    const worktreeResult = createWorktree(worktreePath, branchName, repoPath);
    if (!worktreeResult.success) {
      // Cleanup: try to delete the branch we just created
      try {
        execSync(`git branch -D ${branchName}`, { cwd: repoPath, stdio: 'ignore' });
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: false,
        error: `Failed to create worktree: ${worktreeResult.error}`,
      };
    }

    return {
      success: true,
      data: {
        worktreePath,
        branchName,
      },
    };
  }

  /**
   * Get the worktree path for a run ID
   * @param runId - Run identifier
   * @returns Absolute path to the worktree
   */
  getWorktreePath(runId: string): string {
    return resolve(this.baseDir, runId);
  }

  /**
   * Cleanup a worktree
   * @param runId - Run identifier
   * @param options - Cleanup options
   * @returns GitResult with removed path
   */
  cleanup(runId: string, options?: CleanupOptions): GitResult<string> {
    const worktreePath = this.getWorktreePath(runId);

    // Check if worktree exists
    if (!existsSync(worktreePath)) {
      return {
        success: false,
        error: `Worktree does not exist: ${worktreePath}`,
      };
    }

    // Get the repository path (parent of .git/worktrees)
    // We need to find the main repo to execute git commands
    let repoPath: string | undefined;
    try {
      const gitDir = execSync('git rev-parse --git-common-dir', {
        cwd: worktreePath,
        encoding: 'utf-8',
      }).trim();
      // gitDir is something like /path/to/repo/.git
      repoPath = resolve(gitDir, '..');
    } catch {
      // If we can't find repo, continue anyway - removeWorktree might work
    }

    // Remove worktree
    const removeResult = removeWorktree(worktreePath, repoPath);
    if (!removeResult.success) {
      return {
        success: false,
        error: `Failed to remove worktree: ${removeResult.error}`,
      };
    }

    // Optionally delete branch
    if (options?.deleteBranch && repoPath) {
      const branchName = `agent/run-${runId}`;
      try {
        execSync(`git branch -D ${branchName}`, {
          cwd: repoPath,
          stdio: 'ignore',
        });
      } catch (error) {
        // Branch deletion is optional, log but don't fail
        console.warn(`Failed to delete branch ${branchName}: ${(error as Error).message}`);
      }
    }

    return {
      success: true,
      data: worktreePath,
    };
  }

  /**
   * List all active worktrees managed by this WorktreeManager
   * @param repoPath - Path to the main git repository
   * @returns GitResult with array of active worktrees
   */
  listActive(repoPath: string): GitResult<ActiveWorktree[]> {
    const listResult = listWorktrees(repoPath);
    if (!listResult.success) {
      return {
        success: false,
        error: listResult.error,
      };
    }

    const activeWorktrees: ActiveWorktree[] = [];
    const now = new Date();
    const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

    for (const worktree of listResult.data || []) {
      // Check if this worktree is in our managed directory
      if (!worktree.path.startsWith(this.baseDir)) {
        continue;
      }

      // Extract run ID from path
      const runId = worktree.path.substring(this.baseDir.length + 1);

      // Get creation time from filesystem
      let createdAt = now;
      let isStale = false;

      try {
        if (existsSync(worktree.path)) {
          const stats = statSync(worktree.path);
          // Use mtime as fallback since birthtime is not always available/modifiable
          createdAt = stats.birthtime && stats.birthtime.getTime() > 0 ? stats.birthtime : stats.mtime;
          const ageMs = now.getTime() - createdAt.getTime();
          isStale = ageMs > STALE_THRESHOLD_MS;
        }
      } catch {
        // If we can't stat, assume it's new
        isStale = false;
      }

      activeWorktrees.push({
        ...worktree,
        runId,
        createdAt,
        isStale,
      });
    }

    return {
      success: true,
      data: activeWorktrees,
    };
  }

  /**
   * Create a worktree for a plan step
   * @param planId - Plan identifier
   * @param stepNumber - Step number
   * @param repoPath - Path to the main git repository
   * @param baseBranch - Optional base branch (defaults to current HEAD)
   * @returns GitResult with worktree path and branch name
   */
  createForPlanStep(
    planId: string,
    stepNumber: number,
    repoPath: string,
    baseBranch?: string
  ): GitResult<CreateWorktreeResult> {
    const branchName = `agent/plan-${planId}/step-${stepNumber}`;
    const worktreePath = join(this.baseDir, `plan-${planId}`, `step-${stepNumber}`);

    // Ensure parent directory exists
    try {
      mkdirSync(resolve(worktreePath, '..'), { recursive: true });
    } catch (error) {
      return {
        success: false,
        error: `Failed to create parent directory: ${(error as Error).message}`,
      };
    }

    // Create branch
    const branchResult = createBranch(branchName, baseBranch, repoPath);
    if (!branchResult.success) {
      return {
        success: false,
        error: `Failed to create branch: ${branchResult.error}`,
      };
    }

    // Create worktree
    const worktreeResult = createWorktree(worktreePath, branchName, repoPath);
    if (!worktreeResult.success) {
      // Cleanup: try to delete the branch we just created
      try {
        execSync(`git branch -D ${branchName}`, { cwd: repoPath, stdio: 'ignore' });
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: false,
        error: `Failed to create worktree: ${worktreeResult.error}`,
      };
    }

    return {
      success: true,
      data: {
        worktreePath,
        branchName,
      },
    };
  }
}
