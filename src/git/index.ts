// src/git/index.ts — Git Module Barrel Export

export {
  createBranch,
  createWorktree,
  removeWorktree,
  commit,
  diff,
  getCurrentBranch,
  isClean,
  listWorktrees,
  type GitResult,
  type WorktreeInfo,
} from './git-utils.js';

export {
  WorktreeManager,
  type CleanupOptions,
  type ActiveWorktree,
  type CreateWorktreeResult,
} from './worktree-manager.js';

export {
  isProtectedBranch,
  assertOnAgentBranch,
  wrapTool,
  DEFAULT_PROTECTED_BRANCHES,
  type BranchGuardConfig,
} from './branch-guard.js';

export {
  AutoCommitter,
  type CommitMetadata,
  type CommitInfo,
} from './auto-commit.js';

export {
  DodRunner,
  type CheckResult,
  type DodResult,
  type DodConfig,
} from './dod-runner.js';
