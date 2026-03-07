// src/git/pr-workflow.ts — Automated PR Creation and Status Tracking

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { generateSummary } from './diff-summary.js';

/**
 * Definition of Done result
 */
export interface DodResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; message?: string }>;
  summary: string;
}

/**
 * PR creation options
 */
export interface CreatePrOptions {
  branch: string;
  baseBranch: string;
  title: string;
  runId?: string;
  dodResult?: DodResult;
  cwd?: string;
}

/**
 * PR review status
 */
export type ReviewStatus = 'approved' | 'changes_requested' | 'pending';

/**
 * PR information
 */
export interface PrInfo {
  number: number;
  title: string;
  url: string;
  state: string;
  reviewStatus: ReviewStatus;
}

/**
 * Execute command safely
 */
function execCommand(command: string, cwd?: string): { stdout: string; success: boolean; error?: string } {
  try {
    const workDir = cwd ? resolve(cwd) : process.cwd();
    const stdout = execSync(command, {
      cwd: workDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: stdout.trim(), success: true };
  } catch (error: unknown) {
    const err = error as { stderr?: Buffer; message?: string; code?: number };
    const stderr = err.stderr?.toString('utf-8').trim() || err.message || 'Unknown error';
    return {
      stdout: '',
      success: false,
      error: stderr,
    };
  }
}

/**
 * Check if gh CLI is installed
 */
function checkGhInstalled(): void {
  const result = execCommand('which gh');
  if (!result.success) {
    throw new Error('gh CLI is not installed. Please install it from https://cli.github.com');
  }
}

/**
 * Check if gh is authenticated
 */
function checkGhAuth(): void {
  const result = execCommand('gh auth status');
  if (!result.success) {
    throw new Error('gh CLI is not authenticated. Please run: gh auth login');
  }
}

/**
 * Create a pull request via gh CLI
 * @param options - PR creation options
 * @returns Created PR information
 */
export async function createPr(options: CreatePrOptions): Promise<PrInfo> {
  const { branch, baseBranch, title, runId, dodResult, cwd } = options;

  // Check prerequisites
  checkGhInstalled();
  checkGhAuth();

  // DoD Gate: Only create PR if DoD passed (or not provided)
  if (dodResult && !dodResult.passed) {
    throw new Error(
      `Cannot create PR: DoD checks failed\n${dodResult.summary}\n\n` +
      `Failed checks:\n${dodResult.checks
        .filter((c) => !c.passed)
        .map((c) => `- ${c.name}: ${c.message || 'Failed'}`)
        .join('\n')}`
    );
  }

  // Generate diff summary
  const summary = generateSummary(branch, baseBranch, cwd, runId);

  // Build PR body
  const bodyLines: string[] = [summary.markdown];

  // Add DoD status if provided
  if (dodResult) {
    bodyLines.push('### DoD');
    bodyLines.push(dodResult.passed ? '✅ All checks passed' : '❌ Failed');
    bodyLines.push('');
  }

  const body = bodyLines.join('\n');

  // Build gh pr create command
  const args = [
    'gh pr create',
    `--base "${baseBranch}"`,
    `--head "${branch}"`,
    `--title "${title.replace(/"/g, '\\"')}"`,
    `--body "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
  ];

  const command = args.join(' ');
  const result = execCommand(command, cwd);

  if (!result.success) {
    throw new Error(`Failed to create PR: ${result.error}`);
  }

  // Parse PR URL from output (gh pr create returns the URL)
  const prUrl = result.stdout.trim();
  const prNumberMatch = prUrl.match(/\/pull\/(\d+)$/);
  const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : 0;

  return {
    number: prNumber,
    title,
    url: prUrl,
    state: 'open',
    reviewStatus: 'pending',
  };
}

/**
 * Get PR review status
 * @param prNumber - PR number
 * @param cwd - Optional working directory
 * @returns Review status
 */
export async function getPrStatus(prNumber: number, cwd?: string): Promise<ReviewStatus> {
  checkGhInstalled();
  checkGhAuth();

  // Get PR review status via gh CLI
  const command = `gh pr view ${prNumber} --json reviewDecision -q .reviewDecision`;
  const result = execCommand(command, cwd);

  if (!result.success) {
    throw new Error(`Failed to get PR status: ${result.error}`);
  }

  const decision = result.stdout.trim().toUpperCase();

  // Map GitHub review decision to our ReviewStatus
  if (decision === 'APPROVED') {
    return 'approved';
  } else if (decision === 'CHANGES_REQUESTED') {
    return 'changes_requested';
  } else {
    return 'pending'; // REVIEW_REQUIRED, null, or other
  }
}

/**
 * List open PRs for the repository
 * @param cwd - Optional working directory
 * @returns List of open PRs
 */
export async function listOpenPrs(cwd?: string): Promise<PrInfo[]> {
  checkGhInstalled();
  checkGhAuth();

  // Get open PRs via gh CLI
  const command = 'gh pr list --json number,title,url,state,reviewDecision';
  const result = execCommand(command, cwd);

  if (!result.success) {
    throw new Error(`Failed to list PRs: ${result.error}`);
  }

  if (!result.stdout || result.stdout.trim().length === 0) {
    return [];
  }

  // Parse JSON output
  const prs = JSON.parse(result.stdout) as Array<{
    number: number;
    title: string;
    url: string;
    state: string;
    reviewDecision: string | null;
  }>;

  return prs.map((pr) => {
    let reviewStatus: ReviewStatus = 'pending';
    if (pr.reviewDecision === 'APPROVED') {
      reviewStatus = 'approved';
    } else if (pr.reviewDecision === 'CHANGES_REQUESTED') {
      reviewStatus = 'changes_requested';
    }

    return {
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      reviewStatus,
    };
  });
}
