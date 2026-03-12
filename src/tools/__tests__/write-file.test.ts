// src/tools/__tests__/write-file.test.ts — Tests for WriteFileTool

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { WriteFileTool } from '../write-file.js';

describe('WriteFileTool', () => {
  let tool: WriteFileTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new WriteFileTool();
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `write-file-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should write content to a new file', async () => {
    const filePath = join(testDir, 'new-file.txt');
    const content = 'Hello World';

    const result = await tool.execute({ path: filePath, content });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Successfully wrote');
    expect(result.output).toContain('11 characters');
    expect(result.metadata?.path).toBe(filePath);
    expect(result.metadata?.bytesWritten).toBe(11);

    // Verify file was created with correct content
    const writtenContent = await readFile(filePath, 'utf-8');
    expect(writtenContent).toBe(content);
  });

  it('should create parent directories automatically', async () => {
    const filePath = join(testDir, 'deep', 'nested', 'path', 'file.txt');
    const content = 'Nested file content';

    const result = await tool.execute({ path: filePath, content });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Successfully wrote');

    // Verify file exists at nested location
    const writtenContent = await readFile(filePath, 'utf-8');
    expect(writtenContent).toBe(content);
  });

  it('should overwrite existing file', async () => {
    const filePath = join(testDir, 'existing.txt');
    await writeFile(filePath, 'Old content');

    const newContent = 'New content';
    const result = await tool.execute({ path: filePath, content: newContent });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Successfully wrote');

    // Verify file was overwritten
    const writtenContent = await readFile(filePath, 'utf-8');
    expect(writtenContent).toBe(newContent);
  });

  it('should write empty content', async () => {
    const filePath = join(testDir, 'empty.txt');
    const content = '';

    const result = await tool.execute({ path: filePath, content });

    expect(result.success).toBe(true);
    expect(result.output).toContain('0 characters');
    expect(result.metadata?.bytesWritten).toBe(0);

    const writtenContent = await readFile(filePath, 'utf-8');
    expect(writtenContent).toBe('');
  });

  it('should write large content', async () => {
    const filePath = join(testDir, 'large.txt');
    const lines: string[] = [];
    for (let i = 0; i < 10000; i++) {
      lines.push(`Line ${i}`);
    }
    const content = lines.join('\n');

    const result = await tool.execute({ path: filePath, content });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Successfully wrote');
    expect(result.metadata?.bytesWritten).toBeGreaterThan(50000);

    const writtenContent = await readFile(filePath, 'utf-8');
    expect(writtenContent).toBe(content);
  });

  it('should write special characters', async () => {
    const filePath = join(testDir, 'special.txt');
    const content = 'Special: \n\t\r"\'\\/*?<>|';

    const result = await tool.execute({ path: filePath, content });

    expect(result.success).toBe(true);

    const writtenContent = await readFile(filePath, 'utf-8');
    expect(writtenContent).toBe(content);
  });

  it('should write Unicode content', async () => {
    const filePath = join(testDir, 'unicode.txt');
    const content = '🎉 Hello 世界 🚀\nEmoji and Chinese characters';

    const result = await tool.execute({ path: filePath, content });

    expect(result.success).toBe(true);
    expect(result.metadata?.bytesWritten).toBeGreaterThan(content.length); // UTF-8 multibyte

    const writtenContent = await readFile(filePath, 'utf-8');
    expect(writtenContent).toBe(content);
  });

  it('should handle multiline content', async () => {
    const filePath = join(testDir, 'multiline.txt');
    const content = 'Line 1\nLine 2\nLine 3\n\nLine 5';

    const result = await tool.execute({ path: filePath, content });

    expect(result.success).toBe(true);

    const writtenContent = await readFile(filePath, 'utf-8');
    expect(writtenContent).toBe(content);
  });

  it('should fail when writing to invalid path', async () => {
    // Try to write to a path that cannot be created (e.g., null byte in filename)
    const filePath = join(testDir, 'invalid\x00name.txt');
    const content = 'Should fail';

    const result = await tool.execute({ path: filePath, content });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to write file');
  });
});
