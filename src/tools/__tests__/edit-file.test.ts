// src/tools/__tests__/edit-file.test.ts — Tests for EditFileTool

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EditFileTool } from '../edit-file.js';

describe('EditFileTool', () => {
  let tool: EditFileTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new EditFileTool();
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `edit-file-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should replace exact string match (happy path)', async () => {
    const filePath = join(testDir, 'test.txt');
    await writeFile(filePath, 'Hello World\nThis is a test\nGoodbye');

    const result = await tool.execute({
      path: filePath,
      old_string: 'This is a test',
      new_string: 'This is modified',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Successfully replaced');
    expect(result.metadata?.path).toBe(filePath);
    expect(result.metadata?.oldLength).toBe(14);
    expect(result.metadata?.newLength).toBe(16);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('Hello World\nThis is modified\nGoodbye');
  });

  it('should fail when string is not found (0 matches)', async () => {
    const filePath = join(testDir, 'test.txt');
    await writeFile(filePath, 'Hello World');

    const result = await tool.execute({
      path: filePath,
      old_string: 'Nonexistent',
      new_string: 'Replacement',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('String not found');
    expect(result.error).toContain('Nonexistent');

    // File should be unchanged
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('Hello World');
  });

  it('should fail when string appears multiple times (>1 matches)', async () => {
    const filePath = join(testDir, 'test.txt');
    await writeFile(filePath, 'foo bar foo baz foo');

    const result = await tool.execute({
      path: filePath,
      old_string: 'foo',
      new_string: 'FOO',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Ambiguous replacement');
    expect(result.error).toContain('found 3 times');
    expect(result.error).toContain('Must have exactly one match');

    // File should be unchanged
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('foo bar foo baz foo');
  });

  it('should fail when old_string is empty', async () => {
    const filePath = join(testDir, 'test.txt');
    await writeFile(filePath, 'Hello World');

    const result = await tool.execute({
      path: filePath,
      old_string: '',
      new_string: 'Something',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Ambiguous replacement');
    // Empty string would match everywhere → many matches
  });

  it('should handle multiline replacement', async () => {
    const filePath = join(testDir, 'multiline.txt');
    const originalContent = 'Line 1\nOLD_BLOCK\nLine 2\nLine 3';
    await writeFile(filePath, originalContent);

    const result = await tool.execute({
      path: filePath,
      old_string: 'OLD_BLOCK',
      new_string: 'NEW\nMULTI\nLINE\nBLOCK',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Successfully replaced');

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('Line 1\nNEW\nMULTI\nLINE\nBLOCK\nLine 2\nLine 3');
  });

  it('should handle special characters in strings', async () => {
    const filePath = join(testDir, 'special.txt');
    await writeFile(filePath, 'const regex = /test/g;');

    const result = await tool.execute({
      path: filePath,
      old_string: '/test/g',
      new_string: '/[a-z]+/gi',
    });

    expect(result.success).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('const regex = /[a-z]+/gi;');
  });

  it('should fail when file does not exist', async () => {
    const filePath = join(testDir, 'nonexistent.txt');

    const result = await tool.execute({
      path: filePath,
      old_string: 'foo',
      new_string: 'bar',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to edit file');
  });

  it('should replace with empty string (deletion)', async () => {
    const filePath = join(testDir, 'deletion.txt');
    await writeFile(filePath, 'Hello REMOVE_THIS World');

    const result = await tool.execute({
      path: filePath,
      old_string: 'REMOVE_THIS ',
      new_string: '',
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.newLength).toBe(0);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('Hello World');
  });

  it('should handle Unicode in old_string and new_string', async () => {
    const filePath = join(testDir, 'unicode.txt');
    await writeFile(filePath, 'Hello 世界 from Earth');

    const result = await tool.execute({
      path: filePath,
      old_string: '世界',
      new_string: 'World',
    });

    expect(result.success).toBe(true);

    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('Hello World from Earth');
  });
});
