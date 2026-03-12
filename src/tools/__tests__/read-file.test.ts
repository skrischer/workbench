// src/tools/__tests__/read-file.test.ts — Tests for ReadFileTool

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ReadFileTool } from '../read-file.js';

describe('ReadFileTool', () => {
  let tool: ReadFileTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new ReadFileTool();
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `read-file-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should read entire file content', async () => {
    const filePath = join(testDir, 'test.txt');
    const content = 'Hello World\nLine 2\nLine 3';
    await writeFile(filePath, content);

    const result = await tool.execute({ path: filePath });

    expect(result.success).toBe(true);
    expect(result.output).toBe(content);
    expect(result.metadata?.totalLines).toBe(3);
    expect(result.metadata?.returnedLines).toBe(3);
    expect(result.metadata?.path).toBe(filePath);
  });

  it('should fail when file does not exist', async () => {
    const filePath = join(testDir, 'nonexistent.txt');

    const result = await tool.execute({ path: filePath });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to read file');
    expect(result.error).toContain('nonexistent.txt');
  });

  it('should read file with offset only', async () => {
    const filePath = join(testDir, 'offset.txt');
    const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    await writeFile(filePath, content);

    const result = await tool.execute({ path: filePath, offset: 3 });

    expect(result.success).toBe(true);
    expect(result.output).toBe('Line 3\nLine 4\nLine 5');
    expect(result.metadata?.totalLines).toBe(5);
    expect(result.metadata?.returnedLines).toBe(3);
    expect(result.metadata?.offset).toBe(3);
  });

  it('should read file with limit only', async () => {
    const filePath = join(testDir, 'limit.txt');
    const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
    await writeFile(filePath, content);

    const result = await tool.execute({ path: filePath, limit: 2 });

    expect(result.success).toBe(true);
    expect(result.output).toBe('Line 1\nLine 2');
    expect(result.metadata?.totalLines).toBe(5);
    expect(result.metadata?.returnedLines).toBe(2);
    expect(result.metadata?.limit).toBe(2);
  });

  it('should read file with offset and limit', async () => {
    const filePath = join(testDir, 'offset-limit.txt');
    const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';
    await writeFile(filePath, content);

    const result = await tool.execute({ path: filePath, offset: 2, limit: 3 });

    expect(result.success).toBe(true);
    expect(result.output).toBe('Line 2\nLine 3\nLine 4');
    expect(result.metadata?.totalLines).toBe(6);
    expect(result.metadata?.returnedLines).toBe(3);
    expect(result.metadata?.offset).toBe(2);
    expect(result.metadata?.limit).toBe(3);
  });

  it('should read empty file', async () => {
    const filePath = join(testDir, 'empty.txt');
    await writeFile(filePath, '');

    const result = await tool.execute({ path: filePath });

    expect(result.success).toBe(true);
    expect(result.output).toBe('');
    expect(result.metadata?.totalLines).toBe(1); // Empty file has 1 line (empty string)
    expect(result.metadata?.returnedLines).toBe(1);
  });

  it('should handle large file with offset and limit', async () => {
    const filePath = join(testDir, 'large.txt');
    const lines: string[] = [];
    for (let i = 1; i <= 1000; i++) {
      lines.push(`Line ${i}`);
    }
    await writeFile(filePath, lines.join('\n'));

    const result = await tool.execute({ path: filePath, offset: 500, limit: 10 });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Line 500');
    expect(result.output).toContain('Line 509');
    expect(result.output).not.toContain('Line 499');
    expect(result.output).not.toContain('Line 510');
    expect(result.metadata?.totalLines).toBe(1000);
    expect(result.metadata?.returnedLines).toBe(10);
  });

  it('should handle Unicode content', async () => {
    const filePath = join(testDir, 'unicode.txt');
    const content = '🎉 Hello\n世界\n🚀 Test';
    await writeFile(filePath, content);

    const result = await tool.execute({ path: filePath });

    expect(result.success).toBe(true);
    expect(result.output).toBe(content);
    expect(result.metadata?.totalLines).toBe(3);
  });

  it('should handle offset beyond file length', async () => {
    const filePath = join(testDir, 'short.txt');
    await writeFile(filePath, 'Line 1\nLine 2');

    const result = await tool.execute({ path: filePath, offset: 100 });

    expect(result.success).toBe(true);
    expect(result.output).toBe('');
    expect(result.metadata?.returnedLines).toBe(0);
  });
});
