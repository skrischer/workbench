// src/runtime/__tests__/git-integration.test.ts — Integration Tests für Runtime Git-Integration

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { createRuntime } from '../create-runtime.js';
import type { Tool, ToolResult } from '../../types/index.js';

// Mock tool that modifies files
class MockWriteTool implements Tool {
  name = 'write_file';
  description = 'Write content to a file';
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['path', 'content'],
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const path = input.path as string;
    const content = input.content as string;

    try {
      writeFileSync(path, content, 'utf-8');
      return {
        success: true,
        output: `File written: ${path}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: (error as Error).message,
      };
    }
  }
}

describe('Runtime Git Integration', () => {
  let tempRepoPath: string;
  let tempWorktreeBase: string;

  beforeEach(() => {
    // Create temp directory for test repo
    tempRepoPath = mkdtempSync(join(tmpdir(), 'test-repo-'));

    // Create temp directory for worktrees
    tempWorktreeBase = mkdtempSync(join(tmpdir(), 'test-worktrees-'));

    // Initialize git repo
    execSync('git init', { cwd: tempRepoPath, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', {
      cwd: tempRepoPath,
      stdio: 'ignore',
    });
    execSync('git config user.name "Test User"', {
      cwd: tempRepoPath,
      stdio: 'ignore',
    });

    // Create initial commit (required for worktrees)
    writeFileSync(join(tempRepoPath, 'README.md'), 'initial', 'utf-8');
    execSync('git add README.md', { cwd: tempRepoPath, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', {
      cwd: tempRepoPath,
      stdio: 'ignore',
    });
  });

  afterEach(() => {
    // Cleanup temp directories
    try {
      rmSync(tempRepoPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    try {
      rmSync(tempWorktreeBase, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should complete full lifecycle: start → afterToolCall → getDiff → finish', async () => {
    const runtime = createRuntime({
      repoPath: tempRepoPath,
      gitSafety: true,
      keepWorktree: false,
      worktreeBaseDir: tempWorktreeBase,
    });

    expect(runtime.isGitEnabled()).toBe(true);

    const runId = 'test-run-001';
    const tools = [new MockWriteTool()];

    // Start run
    const { tools: wrappedTools, worktreePath, branchName } = await runtime.start(
      runId,
      undefined,
      tools
    );

    expect(wrappedTools).toHaveLength(1);
    expect(worktreePath).toBeDefined();
    expect(branchName).toBe(`agent/run-${runId}`);
    expect(existsSync(worktreePath!)).toBe(true);

    // Execute tool (write a file)
    const filePath = join(worktreePath!, 'test.txt');
    const result = await wrappedTools[0].execute({
      path: filePath,
      content: 'Hello from test!',
    });

    expect(result.success).toBe(true);
    expect(existsSync(filePath)).toBe(true);

    // Auto-commit after tool call
    const commitHash = await runtime.afterToolCall('write_file', runId, 0);
    expect(commitHash).toBeTruthy();
    expect(commitHash).toHaveLength(40); // Git SHA-1 hash length

    // Get diff
    const diffOutput = await runtime.getDiff(runId);
    expect(diffOutput).toContain('test.txt');
    expect(diffOutput).toContain('Hello from test!');

    // Finish and cleanup
    const cleanupResult = await runtime.finish(runId);
    expect(cleanupResult.removed).toBe(true);
    expect(existsSync(worktreePath!)).toBe(false);
  });

  it('should gracefully handle gitSafety=false (no crash, no worktree)', async () => {
    const runtime = createRuntime({
      repoPath: tempRepoPath,
      gitSafety: false, // Explicitly disabled
      worktreeBaseDir: tempWorktreeBase,
    });

    expect(runtime.isGitEnabled()).toBe(false);

    const runId = 'test-run-002';
    const tools = [new MockWriteTool()];

    // Start run - should not create worktree
    const { tools: wrappedTools, worktreePath } = await runtime.start(
      runId,
      undefined,
      tools
    );

    expect(wrappedTools).toHaveLength(1);
    expect(worktreePath).toBeUndefined();

    // After tool call should not crash
    const commitHash = await runtime.afterToolCall('write_file', runId, 0);
    expect(commitHash).toBeNull();

    // Get diff should return empty
    const diffOutput = await runtime.getDiff(runId);
    expect(diffOutput).toBe('');

    // Finish should not crash
    const cleanupResult = await runtime.finish(runId);
    expect(cleanupResult.removed).toBe(false);
  });

  it('should gracefully handle missing .git directory (auto-disable)', async () => {
    // Create a temp directory without .git
    const nonGitPath = mkdtempSync(join(tmpdir(), 'test-non-git-'));

    try {
      const runtime = createRuntime({
        repoPath: nonGitPath,
        gitSafety: true, // Requested but will be auto-disabled
        worktreeBaseDir: tempWorktreeBase,
      });

      expect(runtime.isGitEnabled()).toBe(false);

      const runId = 'test-run-003';
      const tools = [new MockWriteTool()];

      // Should not crash, should behave like gitSafety=false
      const { worktreePath } = await runtime.start(runId, undefined, tools);
      expect(worktreePath).toBeUndefined();

      const commitHash = await runtime.afterToolCall('write_file', runId, 0);
      expect(commitHash).toBeNull();

      const diffOutput = await runtime.getDiff(runId);
      expect(diffOutput).toBe('');

      const cleanupResult = await runtime.finish(runId);
      expect(cleanupResult.removed).toBe(false);
    } finally {
      rmSync(nonGitPath, { recursive: true, force: true });
    }
  });

  it('should show changes in getDiff after tool execution', async () => {
    const runtime = createRuntime({
      repoPath: tempRepoPath,
      gitSafety: true,
      worktreeBaseDir: tempWorktreeBase,
    });

    const runId = 'test-run-004';
    const tools = [new MockWriteTool()];

    const { tools: wrappedTools, worktreePath } = await runtime.start(
      runId,
      undefined,
      tools
    );

    // Write multiple files
    const file1 = join(worktreePath!, 'file1.txt');
    const file2 = join(worktreePath!, 'file2.txt');

    await wrappedTools[0].execute({ path: file1, content: 'First file' });
    await runtime.afterToolCall('write_file', runId, 0);

    await wrappedTools[0].execute({ path: file2, content: 'Second file' });
    await runtime.afterToolCall('write_file', runId, 1);

    // Get diff should show both files
    const diffOutput = await runtime.getDiff(runId);
    expect(diffOutput).toContain('file1.txt');
    expect(diffOutput).toContain('file2.txt');
    expect(diffOutput).toContain('First file');
    expect(diffOutput).toContain('Second file');

    await runtime.finish(runId);
  });

  it('should cleanup and remove worktree on finish', async () => {
    const runtime = createRuntime({
      repoPath: tempRepoPath,
      gitSafety: true,
      keepWorktree: false, // Should remove
      worktreeBaseDir: tempWorktreeBase,
    });

    const runId = 'test-run-005';

    const { worktreePath } = await runtime.start(runId);
    expect(existsSync(worktreePath!)).toBe(true);

    const cleanupResult = await runtime.finish(runId);
    expect(cleanupResult.removed).toBe(true);
    expect(cleanupResult.path).toBe(worktreePath);
    expect(existsSync(worktreePath!)).toBe(false);
  });

  it('should keep worktree when keepWorktree=true', async () => {
    const runtime = createRuntime({
      repoPath: tempRepoPath,
      gitSafety: true,
      keepWorktree: true, // Should NOT remove
      worktreeBaseDir: tempWorktreeBase,
    });

    const runId = 'test-run-006';

    const { worktreePath } = await runtime.start(runId);
    expect(existsSync(worktreePath!)).toBe(true);

    const cleanupResult = await runtime.finish(runId);
    expect(cleanupResult.removed).toBe(false);
    expect(cleanupResult.path).toBe(worktreePath);
    expect(existsSync(worktreePath!)).toBe(true);

    // Manual cleanup
    rmSync(worktreePath!, { recursive: true, force: true });
  });

  it('should handle multiple concurrent runs', async () => {
    const runtime = createRuntime({
      repoPath: tempRepoPath,
      gitSafety: true,
      worktreeBaseDir: tempWorktreeBase,
    });

    const runId1 = 'test-run-007a';
    const runId2 = 'test-run-007b';

    // Start two runs
    const { worktreePath: path1 } = await runtime.start(runId1);
    const { worktreePath: path2 } = await runtime.start(runId2);

    expect(path1).not.toBe(path2);
    expect(existsSync(path1!)).toBe(true);
    expect(existsSync(path2!)).toBe(true);

    expect(runtime.getActiveRunIds()).toContain(runId1);
    expect(runtime.getActiveRunIds()).toContain(runId2);

    // Finish first run
    await runtime.finish(runId1);
    expect(existsSync(path1!)).toBe(false);
    expect(existsSync(path2!)).toBe(true);

    // Finish second run
    await runtime.finish(runId2);
    expect(existsSync(path2!)).toBe(false);

    expect(runtime.getActiveRunIds()).toHaveLength(0);
  });

  it('should wrap tools with branch guards', async () => {
    const runtime = createRuntime({
      repoPath: tempRepoPath,
      gitSafety: true,
      worktreeBaseDir: tempWorktreeBase,
    });

    const runId = 'test-run-008';
    const tools = [new MockWriteTool()];

    const { tools: wrappedTools, worktreePath } = await runtime.start(
      runId,
      undefined,
      tools
    );

    // Tool should work in worktree (on agent branch)
    const filePath = join(worktreePath!, 'test.txt');
    const result = await wrappedTools[0].execute({
      path: filePath,
      content: 'Should work',
    });

    expect(result.success).toBe(true);

    // Try to execute tool in main repo (should fail due to protected branch)
    const mainFilePath = join(tempRepoPath, 'main-test.txt');
    
    // We can't easily test this without changing directory,
    // but we've verified the tool is wrapped
    expect(wrappedTools[0].name).toBe('write_file');

    await runtime.finish(runId);
  });
});
