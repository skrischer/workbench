// src/git/git-utils.ts — Low-Level Git CLI Wrappers

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Result structure for git operations
 */
export interface GitResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Worktree information
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isPrunable: boolean;
}

/**
 * Execute a git command safely
 */
function execGit(command: string, cwd?: string): { stdout: string; stderr: string; success: boolean } {
  try {
    const workDir = cwd ? resolve(cwd) : process.cwd();
    const stdout = execSync(command, {
      cwd: workDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: stdout.trim(), stderr: '', success: true };
  } catch (error: unknown) {
    const err = error as { stderr?: Buffer; stdout?: Buffer; message?: string };
    return {
      stdout: err.stdout?.toString('utf-8').trim() || '',
      stderr: err.stderr?.toString('utf-8').trim() || err.message || 'Unknown error',
      success: false,
    };
  }
}

/**
 * Create a new git branch
 * @param name - Branch name
 * @param baseBranch - Optional base branch (defaults to current HEAD)
 * @param cwd - Optional working directory
 * @returns GitResult with branch name
 */
export function createBranch(name: string, baseBranch?: string, cwd?: string): GitResult<string> {
  const base = baseBranch ? baseBranch : 'HEAD';
  const result = execGit(`git branch ${name} ${base}`, cwd);

  if (!result.success) {
    return {
      success: false,
      error: result.stderr || 'Failed to create branch',
    };
  }

  return {
    success: true,
    data: name,
  };
}

/**
 * Create a git worktree
 * @param path - Path where worktree should be created
 * @param branch - Branch name for the worktree
 * @param cwd - Optional working directory (main repo)
 * @returns GitResult with worktree path
 */
export function createWorktree(path: string, branch: string, cwd?: string): GitResult<string> {
  const worktreePath = resolve(path);
  const result = execGit(`git worktree add "${worktreePath}" "${branch}"`, cwd);

  if (!result.success) {
    return {
      success: false,
      error: result.stderr || 'Failed to create worktree',
    };
  }

  return {
    success: true,
    data: worktreePath,
  };
}

/**
 * Remove a git worktree
 * @param path - Path of the worktree to remove
 * @param cwd - Optional working directory (main repo)
 * @returns GitResult with removed path
 */
export function removeWorktree(path: string, cwd?: string): GitResult<string> {
  const worktreePath = resolve(path);

  // Remove worktree
  const result = execGit(`git worktree remove "${worktreePath}" --force`, cwd);

  if (!result.success) {
    return {
      success: false,
      error: result.stderr || 'Failed to remove worktree',
    };
  }

  return {
    success: true,
    data: worktreePath,
  };
}

/**
 * Stage all changes and create a commit
 * @param message - Commit message
 * @param cwd - Optional working directory
 * @returns GitResult with commit hash
 */
export function commit(message: string, cwd?: string): GitResult<string> {
  // Stage all changes
  const addResult = execGit('git add -A', cwd);
  if (!addResult.success) {
    return {
      success: false,
      error: addResult.stderr || 'Failed to stage changes',
    };
  }

  // Create commit
  const commitResult = execGit(`git commit -m "${message.replace(/"/g, '\\"')}"`, cwd);
  if (!commitResult.success) {
    return {
      success: false,
      error: commitResult.stderr || 'Failed to create commit',
    };
  }

  // Get commit hash
  const hashResult = execGit('git rev-parse HEAD', cwd);
  if (!hashResult.success) {
    return {
      success: false,
      error: 'Commit created but failed to get hash',
    };
  }

  return {
    success: true,
    data: hashResult.stdout,
  };
}

/**
 * Get unified diff between branches/commits
 * @param branch1 - First branch/commit
 * @param branch2 - Optional second branch/commit (defaults to current HEAD)
 * @param cwd - Optional working directory
 * @returns GitResult with diff output
 */
export function diff(branch1: string, branch2?: string, cwd?: string): GitResult<string> {
  const command = branch2 ? `git diff ${branch1} ${branch2}` : `git diff ${branch1}`;
  const result = execGit(command, cwd);

  // Diff can return empty string (no changes) with success
  return {
    success: true,
    data: result.stdout,
  };
}

/**
 * Get current branch name
 * @param cwd - Optional working directory
 * @returns GitResult with branch name
 */
export function getCurrentBranch(cwd?: string): GitResult<string> {
  const result = execGit('git rev-parse --abbrev-ref HEAD', cwd);

  if (!result.success) {
    return {
      success: false,
      error: result.stderr || 'Failed to get current branch',
    };
  }

  return {
    success: true,
    data: result.stdout,
  };
}

/**
 * Check if working directory is clean (no uncommitted changes)
 * @param cwd - Optional working directory
 * @returns GitResult with boolean indicating if clean
 */
export function isClean(cwd?: string): GitResult<boolean> {
  const result = execGit('git status --porcelain', cwd);

  if (!result.success) {
    return {
      success: false,
      error: result.stderr || 'Failed to check status',
    };
  }

  // Empty output means clean working directory
  const clean = result.stdout.length === 0;

  return {
    success: true,
    data: clean,
  };
}

/**
 * List all worktrees
 * @param cwd - Optional working directory (main repo)
 * @returns GitResult with array of WorktreeInfo
 */
export function listWorktrees(cwd?: string): GitResult<WorktreeInfo[]> {
  const result = execGit('git worktree list --porcelain', cwd);

  if (!result.success) {
    return {
      success: false,
      error: result.stderr || 'Failed to list worktrees',
    };
  }

  const worktrees: WorktreeInfo[] = [];
  const lines = result.stdout.split('\n');
  let current: Partial<WorktreeInfo> = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        worktrees.push(current as WorktreeInfo);
      }
      current = { path: line.substring(9), isPrunable: false };
    } else if (line.startsWith('HEAD ')) {
      current.commit = line.substring(5);
    } else if (line.startsWith('branch ')) {
      current.branch = line.substring(7);
    } else if (line === 'prunable') {
      current.isPrunable = true;
    } else if (line === '') {
      if (current.path) {
        worktrees.push(current as WorktreeInfo);
        current = {};
      }
    }
  }

  // Add last worktree if exists
  if (current.path) {
    worktrees.push(current as WorktreeInfo);
  }

  return {
    success: true,
    data: worktrees,
  };
}
