// src/git/__tests__/auto-commit.test.ts — Tests for AutoCommitter

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { AutoCommitter } from '../auto-commit.js';

describe('AutoCommitter', () => {
  let tempDir: string;
  let autoCommitter: AutoCommitter;

  beforeEach(() => {
    // Create temp directory for test repo
    tempDir = join('/tmp', `auto-commit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });

    // Initialize git repo
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test User"', { cwd: tempDir });

    // Create initial commit so we have a proper git history
    writeFileSync(join(tempDir, 'README.md'), '# Test Repo\n');
    execSync('git add -A', { cwd: tempDir });
    execSync('git commit -m "Initial commit"', { cwd: tempDir });

    autoCommitter = new AutoCommitter();
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('parseCommitMessage', () => {
    it('should parse valid workbench commit message', () => {
      const message = `[workbench] read_file: auto-commit

Run: run-123
Step: 5
Tool: read_file`;

      const result = AutoCommitter.parseCommitMessage(message);

      expect(result).not.toBeNull();
      expect(result?.toolName).toBe('read_file');
      expect(result?.runId).toBe('run-123');
      expect(result?.stepIndex).toBe(5);
    });

    it('should return null for non-workbench commit', () => {
      const message = 'Regular commit message';
      const result = AutoCommitter.parseCommitMessage(message);
      expect(result).toBeNull();
    });

    it('should return null for malformed workbench commit', () => {
      const message = `[workbench] some tool

Run: abc
Missing step info`;

      const result = AutoCommitter.parseCommitMessage(message);
      expect(result).toBeNull();
    });
  });

  describe('commitAfterTool', () => {
    it('should create commit when changes exist', async () => {
      // Make a change
      writeFileSync(join(tempDir, 'test.txt'), 'Hello World');

      const result = await autoCommitter.commitAfterTool('write_file', 'run-456', 3, tempDir);

      expect(result.success).toBe(true);
      expect(result.data).toBeTruthy();
      expect(typeof result.data).toBe('string');

      // Verify commit was created
      const log = execSync('git log -1 --format=%B', { cwd: tempDir, encoding: 'utf-8' });
      expect(log).toContain('[workbench] write_file: auto-commit');
      expect(log).toContain('Run: run-456');
      expect(log).toContain('Step: 3');
    });

    it('should not create commit when working directory is clean', async () => {
      const result = await autoCommitter.commitAfterTool('read_file', 'run-789', 1, tempDir);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();

      // Verify no new commit was created (still just initial commit)
      const log = execSync('git log --oneline', { cwd: tempDir, encoding: 'utf-8' });
      const commitCount = log.trim().split('\n').length;
      expect(commitCount).toBe(1); // Only initial commit
    });
  });

  describe('getStepCommits', () => {
    it('should return commits for specific step', async () => {
      // Create multiple commits
      writeFileSync(join(tempDir, 'file1.txt'), 'Content 1');
      await autoCommitter.commitAfterTool('write_file', 'run-111', 2, tempDir);

      writeFileSync(join(tempDir, 'file2.txt'), 'Content 2');
      await autoCommitter.commitAfterTool('edit_file', 'run-111', 2, tempDir);

      writeFileSync(join(tempDir, 'file3.txt'), 'Content 3');
      await autoCommitter.commitAfterTool('write_file', 'run-111', 3, tempDir);

      // Get commits for step 2
      const result = await autoCommitter.getStepCommits('run-111', 2, tempDir);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].metadata.stepIndex).toBe(2);
      expect(result.data?.[1].metadata.stepIndex).toBe(2);
    });

    it('should return empty array when no commits match', async () => {
      const result = await autoCommitter.getStepCommits('run-nonexistent', 99, tempDir);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('rollbackStep', () => {
    it('should revert all commits for a step', async () => {
      // Create commits for step
      writeFileSync(join(tempDir, 'file1.txt'), 'Content 1');
      await autoCommitter.commitAfterTool('write_file', 'run-222', 5, tempDir);

      writeFileSync(join(tempDir, 'file2.txt'), 'Content 2');
      await autoCommitter.commitAfterTool('write_file', 'run-222', 5, tempDir);

      // Verify files exist
      expect(existsSync(join(tempDir, 'file1.txt'))).toBe(true);
      expect(existsSync(join(tempDir, 'file2.txt'))).toBe(true);

      // Rollback step
      const result = await autoCommitter.rollbackStep('run-222', 5, tempDir);

      expect(result.success).toBe(true);
      expect(result.data).toBe(2); // 2 commits reverted

      // Verify files are gone (reverted)
      expect(existsSync(join(tempDir, 'file1.txt'))).toBe(false);
      expect(existsSync(join(tempDir, 'file2.txt'))).toBe(false);
    });

    it('should return 0 when no commits to rollback', async () => {
      const result = await autoCommitter.rollbackStep('run-999', 1, tempDir);

      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });
  });
});
