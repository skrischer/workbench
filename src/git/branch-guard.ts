// src/git/branch-guard.ts — Branch Guards for File-Modifying Tools

import { getCurrentBranch } from './git-utils.js';
import type { Tool, ToolResult } from '../types/index.js';

/**
 * Configuration for branch guard behavior
 */
export interface BranchGuardConfig {
  /** Whether branch guards are enabled (default: true) */
  enabled?: boolean;
  /** List of protected branch patterns (supports glob with *) */
  protectedBranches?: string[];
}

/**
 * Default protected branch patterns
 */
export const DEFAULT_PROTECTED_BRANCHES = [
  'main',
  'master',
  'develop',
  'release/*',
  'hotfix/*',
];

/**
 * Check if a branch name matches a protected pattern.
 * Supports glob patterns with * wildcard.
 * 
 * @param branch - Branch name to check
 * @param patterns - Array of branch patterns (defaults to DEFAULT_PROTECTED_BRANCHES)
 * @returns true if branch matches any protected pattern
 * 
 * @example
 * isProtectedBranch('main') // true
 * isProtectedBranch('release/1.0') // true
 * isProtectedBranch('agent/feature') // false
 */
export function isProtectedBranch(
  branch: string,
  patterns: string[] = DEFAULT_PROTECTED_BRANCHES
): boolean {
  return patterns.some(pattern => {
    // Exact match
    if (pattern === branch) {
      return true;
    }
    
    // Glob pattern with * wildcard
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
        .replace(/\*/g, '.*'); // Convert * to .*
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(branch);
    }
    
    return false;
  });
}

/**
 * Assert that the current branch has the 'agent/' prefix.
 * Throws an error if not on an agent branch or if unable to determine branch.
 * 
 * @param cwd - Optional working directory
 * @throws Error if not on an agent branch or if branch check fails
 * 
 * @example
 * assertOnAgentBranch() // throws if not on agent/* branch
 * assertOnAgentBranch('/path/to/repo')
 */
export function assertOnAgentBranch(cwd?: string): void {
  const result = getCurrentBranch(cwd);
  
  if (!result.success || !result.data) {
    throw new Error(`Failed to get current branch: ${result.error || 'Unknown error'}`);
  }
  
  const branch = result.data;
  
  if (!branch.startsWith('agent/')) {
    throw new Error(
      `Branch guard violation: Current branch '${branch}' does not have 'agent/' prefix. ` +
      `File-modifying operations are only allowed on agent branches.`
    );
  }
}

/**
 * Wrap a tool with branch guard protection.
 * The wrapped tool will check the current branch before executing.
 * If not on an agent branch (or on a protected branch), returns an error ToolResult.
 * 
 * @param tool - The tool to wrap
 * @param config - Optional configuration
 * @returns Wrapped tool with branch guard protection
 * 
 * @example
 * const guardedTool = wrapTool(writeTool, { enabled: true });
 * const guardedTool = wrapTool(editTool, { protectedBranches: ['main', 'prod/*'] });
 */
export function wrapTool(tool: Tool, config: BranchGuardConfig = {}): Tool {
  const {
    enabled = true,
    protectedBranches = DEFAULT_PROTECTED_BRANCHES,
  } = config;
  
  // If guards are disabled, return original tool
  if (!enabled) {
    return tool;
  }
  
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    
    async execute(input: Record<string, unknown>): Promise<ToolResult> {
      // Check current branch
      const branchResult = getCurrentBranch();
      
      if (!branchResult.success || !branchResult.data) {
        return {
          success: false,
          output: '',
          error: `Branch guard: Failed to get current branch: ${branchResult.error || 'Unknown error'}`,
        };
      }
      
      const currentBranch = branchResult.data;
      
      // Check if on protected branch
      if (isProtectedBranch(currentBranch, protectedBranches)) {
        return {
          success: false,
          output: '',
          error: `Branch guard: Cannot execute '${tool.name}' on protected branch '${currentBranch}'. ` +
                 `File-modifying operations are only allowed on agent branches (agent/* prefix).`,
        };
      }
      
      // Check if on agent branch
      if (!currentBranch.startsWith('agent/')) {
        return {
          success: false,
          output: '',
          error: `Branch guard: Cannot execute '${tool.name}' on branch '${currentBranch}'. ` +
                 `File-modifying operations are only allowed on agent branches (agent/* prefix).`,
        };
      }
      
      // All checks passed, execute the original tool
      return tool.execute(input);
    },
  };
}
