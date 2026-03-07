// src/git/__tests__/git-utils.test.ts — Git Utils Tests

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import {
  createBranch,
  createWorktree,
  removeWorktree,
  commit,
  diff,
  getCurrentBranch,
  isClean,
  listWorktrees,
} from '../git-utils.js';

describe('git-utils', () => {
  let testRepo: string;

  beforeEach(() => {
    // Create temp directory for test repo
    testRepo = mkdtempSync(join(tmpdir(), 'git-test-'));

    // Initialize git repo
    execSync('git init', { cwd: testRepo, stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { cwd: testRepo, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: testRepo, stdio: 'pipe' });

    // Create initial commit
    writeFileSync(join(testRepo, 'README.md'), '# Test Repo\n');
    execSync('git add README.md', { cwd: testRepo, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: testRepo, stdio: 'pipe' });
  });

  afterEach(() => {
    // Clean up temp directory
    if (testRepo) {
      rmSync(testRepo, { recursive: true, force: true });
    }
  });

  it('should get current branch name', () => {
    const result = getCurrentBranch(testRepo);

    expect(result.success).toBe(true);
    expect(['master', 'main']).toContain(result.data); // Git default branch can be main or master
    expect(result.error).toBeUndefined();
  });

  it('should create a new branch', () => {
    const result = createBranch('feature-test', undefined, testRepo);

    expect(result.success).toBe(true);
    expect(result.data).toBe('feature-test');
    expect(result.error).toBeUndefined();

    // Verify branch exists
    const branches = execSync('git branch', { cwd: testRepo, encoding: 'utf-8' });
    expect(branches).toContain('feature-test');
  });

  it('should create branch from specific base', () => {
    // Create another commit
    writeFileSync(join(testRepo, 'file.txt'), 'content');
    execSync('git add file.txt', { cwd: testRepo, stdio: 'pipe' });
    execSync('git commit -m "Add file"', { cwd: testRepo, stdio: 'pipe' });

    // Get commit hash before creating branch
    const hash = execSync('git rev-parse HEAD~1', { cwd: testRepo, encoding: 'utf-8' }).trim();

    // Create branch from previous commit
    const result = createBranch('old-branch', hash, testRepo);

    expect(result.success).toBe(true);
    expect(result.data).toBe('old-branch');
  });

  it('should check if working directory is clean', () => {
    // Should be clean initially
    let result = isClean(testRepo);
    expect(result.success).toBe(true);
    expect(result.data).toBe(true);

    // Add uncommitted change
    writeFileSync(join(testRepo, 'dirty.txt'), 'uncommitted');

    result = isClean(testRepo);
    expect(result.success).toBe(true);
    expect(result.data).toBe(false);
  });

  it('should commit staged changes', () => {
    // Add file
    writeFileSync(join(testRepo, 'new-file.txt'), 'test content');

    const result = commit('Add new file', testRepo);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.length).toBe(40); // SHA-1 hash length
    expect(result.error).toBeUndefined();

    // Verify commit exists
    const log = execSync('git log --oneline', { cwd: testRepo, encoding: 'utf-8' });
    expect(log).toContain('Add new file');
  });

  it('should get diff between branches', () => {
    // Get default branch name (could be main or master)
    const defaultBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: testRepo, encoding: 'utf-8' }).trim();
    
    // Create a new branch and add changes
    execSync('git checkout -b feature', { cwd: testRepo, stdio: 'pipe' });
    writeFileSync(join(testRepo, 'feature.txt'), 'feature content');
    execSync('git add feature.txt', { cwd: testRepo, stdio: 'pipe' });
    execSync('git commit -m "Add feature"', { cwd: testRepo, stdio: 'pipe' });

    // Get diff between branches (without .., which compares working trees)
    const result = diff(defaultBranch, 'feature', testRepo);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data).toContain('feature.txt');
    expect(result.data).toContain('feature content');
  });

  it('should create and list worktrees', () => {
    // Create a new branch for worktree
    createBranch('worktree-branch', undefined, testRepo);

    const worktreePath = join(testRepo, '..', 'test-worktree');
    const createResult = createWorktree(worktreePath, 'worktree-branch', testRepo);

    expect(createResult.success).toBe(true);
    expect(createResult.data).toBe(worktreePath);

    // List worktrees
    const listResult = listWorktrees(testRepo);

    expect(listResult.success).toBe(true);
    expect(listResult.data).toBeDefined();
    expect(listResult.data!.length).toBeGreaterThanOrEqual(2); // Main + worktree

    const worktree = listResult.data!.find((w) => w.path === worktreePath);
    expect(worktree).toBeDefined();
    expect(worktree!.branch).toContain('worktree-branch');

    // Clean up worktree
    rmSync(worktreePath, { recursive: true, force: true });
  });

  it('should remove worktree', () => {
    // Create branch and worktree
    createBranch('temp-branch', undefined, testRepo);
    const worktreePath = join(testRepo, '..', 'temp-worktree');
    createWorktree(worktreePath, 'temp-branch', testRepo);

    // Remove worktree
    const result = removeWorktree(worktreePath, testRepo);

    expect(result.success).toBe(true);
    expect(result.data).toBe(worktreePath);

    // Verify worktree is removed from list
    const listResult = listWorktrees(testRepo);
    const worktree = listResult.data!.find((w) => w.path === worktreePath);
    expect(worktree).toBeUndefined();
  });

  it('should handle errors gracefully', () => {
    // Try to create branch with invalid name
    const result = createBranch('invalid..name', undefined, testRepo);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });
});
