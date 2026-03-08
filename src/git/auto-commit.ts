// src/git/auto-commit.ts — Auto-Commit After Tool Execution & Step-Level Rollback

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { commit, isClean } from './git-utils.js';
import type { GitResult } from './git-utils.js';

/**
 * Parsed commit message metadata
 */
export interface CommitMetadata {
  toolName: string;
  runId: string;
  stepIndex: number;
}

/**
 * Commit information with metadata
 */
export interface CommitInfo {
  hash: string;
  message: string;
  metadata: CommitMetadata;
}

/**
 * Execute git command and return result
 */
function execGit(command: string, cwd?: string): { stdout: string; success: boolean } {
  try {
    const workDir = cwd ? resolve(cwd) : process.cwd();
    const stdout = execSync(command, {
      cwd: workDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: stdout.trim(), success: true };
  } catch (error: unknown) {
    const err = error as { stdout?: Buffer; message?: string };
    return {
      stdout: err.stdout?.toString('utf-8').trim() || '',
      success: false,
    };
  }
}

/**
 * AutoCommitter - Manages automatic commits after tool executions
 * and provides step-level rollback functionality
 */
export class AutoCommitter {
  /**
   * Parse commit message to extract metadata
   * @param message - Commit message to parse
   * @returns Parsed metadata or null if not a workbench auto-commit
   */
  static parseCommitMessage(message: string): CommitMetadata | null {
    // Check if this is a workbench auto-commit
    if (!message.startsWith('[workbench]')) {
      return null;
    }

    // Extract metadata using regex
    const runMatch = message.match(/Run:\s*(.+)/);
    const stepMatch = message.match(/Step:\s*(\d+)/);
    const toolMatch = message.match(/Tool:\s*(.+)/);

    if (!runMatch || !stepMatch || !toolMatch) {
      return null;
    }

    return {
      runId: runMatch[1].trim(),
      stepIndex: parseInt(stepMatch[1], 10),
      toolName: toolMatch[1].trim(),
    };
  }

  /**
   * Commit changes after tool execution
   * @param toolName - Name of the tool that was executed
   * @param runId - Run identifier
   * @param stepIndex - Step index in the run
   * @param cwd - Working directory
   * @returns GitResult with commit hash, or success=true with no data if nothing to commit
   */
  async commitAfterTool(
    toolName: string,
    runId: string,
    stepIndex: number,
    cwd?: string
  ): Promise<GitResult<string | null>> {
    // Check if there are changes to commit
    const cleanResult = isClean(cwd);
    if (!cleanResult.success) {
      return {
        success: false,
        error: cleanResult.error,
      };
    }

    // No changes to commit
    if (cleanResult.data === true) {
      return {
        success: true,
        data: null,
      };
    }

    // Build commit message
    const message = `[workbench] ${toolName}: auto-commit

Run: ${runId}
Step: ${stepIndex}
Tool: ${toolName}`;

    // Create commit
    const commitResult = commit(message, cwd);
    if (!commitResult.success) {
      return {
        success: false,
        error: commitResult.error,
      };
    }

    return {
      success: true,
      data: commitResult.data,
    };
  }

  /**
   * Get all commits for a specific step
   * @param runId - Run identifier
   * @param stepIndex - Step index
   * @param cwd - Working directory
   * @returns GitResult with array of commits
   */
  async getStepCommits(runId: string, stepIndex: number, cwd?: string): Promise<GitResult<CommitInfo[]>> {
    // Get all commits with their messages
    const logResult = execGit('git log --format=%H%n%B%n---COMMIT-END--- --all', cwd);

    if (!logResult.success) {
      return {
        success: false,
        error: 'Failed to get commit log',
      };
    }

    // Parse commits
    const commits: CommitInfo[] = [];
    const commitBlocks = logResult.stdout.split('---COMMIT-END---').filter((block) => block.trim());

    for (const block of commitBlocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;

      const hash = lines[0];
      const message = lines.slice(1).join('\n');

      // Parse metadata
      const metadata = AutoCommitter.parseCommitMessage(message);
      if (!metadata) continue;

      // Filter by runId and stepIndex
      if (metadata.runId === runId && metadata.stepIndex === stepIndex) {
        commits.push({ hash, message, metadata });
      }
    }

    return {
      success: true,
      data: commits,
    };
  }

  /**
   * Rollback all commits for a specific step
   * @param runId - Run identifier
   * @param stepIndex - Step index
   * @param cwd - Working directory
   * @returns GitResult with number of reverted commits
   */
  async rollbackStep(runId: string, stepIndex: number, cwd?: string): Promise<GitResult<number>> {
    // Get commits for this step
    const commitsResult = await this.getStepCommits(runId, stepIndex, cwd);
    if (!commitsResult.success) {
      return {
        success: false,
        error: commitsResult.error,
      };
    }

    const commits = commitsResult.data || [];
    if (commits.length === 0) {
      return {
        success: true,
        data: 0,
      };
    }

    // Revert commits in reverse order (newest first)
    const reversedCommits = [...commits].reverse();
    let revertedCount = 0;

    for (const commitInfo of reversedCommits) {
      const revertResult = execGit(`git revert --no-edit ${commitInfo.hash}`, cwd);
      if (!revertResult.success) {
        return {
          success: false,
          error: `Failed to revert commit ${commitInfo.hash}`,
        };
      }
      revertedCount++;
    }

    return {
      success: true,
      data: revertedCount,
    };
  }
}
