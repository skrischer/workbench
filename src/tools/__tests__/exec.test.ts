// src/tools/__tests__/exec.test.ts — Tests for ExecTool

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ExecTool } from '../exec.js';

describe('ExecTool', () => {
  let tool: ExecTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new ExecTool();
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `exec-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should execute simple command successfully', async () => {
    const result = await tool.execute({ command: 'echo "Hello World"' });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello World');
    expect(result.metadata?.exitCode).toBe(0);
    expect(result.metadata?.command).toBe('echo "Hello World"');
  });

  it('should fail with non-zero exit code', async () => {
    const result = await tool.execute({ command: 'exit 42' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Command failed with exit code 42');
    expect(result.metadata?.exitCode).toBe(42);
  });

  it('should timeout long-running command', async () => {
    const result = await tool.execute({
      command: 'sleep 10',
      timeout_ms: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(result.error).toContain('100ms');
    expect(result.metadata?.timeout).toBe(true);
    expect(result.metadata?.exitCode).toBe(-1);
  }, 10000); // Vitest timeout higher than command timeout

  it('should use custom working directory (cwd)', async () => {
    await writeFile(join(testDir, 'test.txt'), 'test content');

    const result = await tool.execute({
      command: 'ls test.txt',
      cwd: testDir,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('test.txt');
    expect(result.metadata?.cwd).toBe(testDir);
  });

  it('should capture stderr output', async () => {
    // Write to stderr using >&2
    const result = await tool.execute({
      command: 'echo "Error message" >&2',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Error message');
  });

  it('should capture stdout output', async () => {
    const result = await tool.execute({
      command: 'echo "Standard output"',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Standard output');
  });

  it('should combine stdout and stderr', async () => {
    const result = await tool.execute({
      command: 'echo "stdout" && echo "stderr" >&2',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('stdout');
    expect(result.output).toContain('stderr');
  });

  it('should fail when command is not found', async () => {
    const result = await tool.execute({
      command: 'nonexistent_command_12345',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Command failed with exit code 127');
  });

  it('should handle multiline output', async () => {
    const result = await tool.execute({
      command: 'printf "Line 1\\nLine 2\\nLine 3"',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Line 1');
    expect(result.output).toContain('Line 2');
    expect(result.output).toContain('Line 3');
  });

  it('should use default timeout when not specified', async () => {
    const result = await tool.execute({
      command: 'echo "test"',
    });

    expect(result.success).toBe(true);
    // Default timeout is 30000ms, command should complete quickly
  });

  it('should handle commands with pipes', async () => {
    const result = await tool.execute({
      command: 'echo "hello world" | grep "world"',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('hello world');
  });

  it('should trim output whitespace', async () => {
    const result = await tool.execute({
      command: 'echo "  test  "',
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe('test');
  });
});
