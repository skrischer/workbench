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
