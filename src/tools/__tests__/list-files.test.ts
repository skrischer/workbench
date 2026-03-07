// src/tools/__tests__/list-files.test.ts — Tests for ListFilesTool

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ListFilesTool } from '../list-files.js';

describe('ListFilesTool', () => {
  let tool: ListFilesTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new ListFilesTool();
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `list-files-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should list files in a basic tree structure', async () => {
    // Create test structure
    await writeFile(join(testDir, 'file1.txt'), 'content');
    await writeFile(join(testDir, 'file2.ts'), 'content');
    await mkdir(join(testDir, 'subdir'));
    await writeFile(join(testDir, 'subdir', 'nested.js'), 'content');

    const result = await tool.execute({ path: testDir });

    expect(result.success).toBe(true);
    expect(result.output).toContain('file1.txt');
    expect(result.output).toContain('file2.ts');
    expect(result.output).toContain('subdir/');
    expect(result.output).toContain('nested.js');
    expect(result.output).toMatch(/\d+ file\(s\)/);
    expect(result.metadata?.fileCount).toBe(3);
    expect(result.metadata?.directoryCount).toBe(1);
  });

  it('should respect depth limit', async () => {
    // Create nested structure
    await mkdir(join(testDir, 'level1'), { recursive: true });
    await mkdir(join(testDir, 'level1', 'level2'), { recursive: true });
    await mkdir(join(testDir, 'level1', 'level2', 'level3'), { recursive: true });
    await writeFile(join(testDir, 'root.txt'), 'content');
    await writeFile(join(testDir, 'level1', 'l1.txt'), 'content');
    await writeFile(join(testDir, 'level1', 'level2', 'l2.txt'), 'content');
    await writeFile(join(testDir, 'level1', 'level2', 'level3', 'l3.txt'), 'content');

    // Test with depth 1 (should show level1 dir and root.txt, but not deeper files)
    const result = await tool.execute({ path: testDir, depth: 1 });

    expect(result.success).toBe(true);
    expect(result.output).toContain('root.txt');
    expect(result.output).toContain('level1/');
    expect(result.output).toContain('l1.txt');
    expect(result.output).not.toContain('l2.txt');
    expect(result.output).not.toContain('l3.txt');
  });

  it('should filter files by glob pattern', async () => {
    // Create files with different extensions
    await writeFile(join(testDir, 'test.ts'), 'content');
    await writeFile(join(testDir, 'test.js'), 'content');
    await writeFile(join(testDir, 'readme.md'), 'content');
    await writeFile(join(testDir, 'config.json'), 'content');

    // Filter for .ts files only
    const result = await tool.execute({ path: testDir, pattern: '*.ts' });

    expect(result.success).toBe(true);
    expect(result.output).toContain('test.ts');
    expect(result.output).not.toContain('test.js');
    expect(result.output).not.toContain('readme.md');
    expect(result.output).not.toContain('config.json');
  });

  it('should apply ignore patterns', async () => {
    // Create structure with node_modules (default ignore)
    await mkdir(join(testDir, 'node_modules'));
    await writeFile(join(testDir, 'node_modules', 'package.json'), 'content');
    await mkdir(join(testDir, 'custom-ignore'));
    await writeFile(join(testDir, 'custom-ignore', 'file.txt'), 'content');
    await writeFile(join(testDir, 'included.txt'), 'content');

    // Test with additional ignore pattern
    const result = await tool.execute({
      path: testDir,
      ignore: ['custom-ignore'],
    });

    expect(result.success).toBe(true);
    expect(result.output).not.toContain('node_modules'); // Default ignore
    expect(result.output).not.toContain('custom-ignore'); // Custom ignore
    expect(result.output).toContain('included.txt');
  });

  it('should handle non-existent path', async () => {
    const nonExistentPath = join(testDir, 'does-not-exist');

    const result = await tool.execute({ path: nonExistentPath });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('does-not-exist');
  });

  it('should handle empty directory', async () => {
    // testDir is already empty
    const result = await tool.execute({ path: testDir });

    expect(result.success).toBe(true);
    expect(result.output).toMatch(/0 file\(s\), 0 director/);
    expect(result.metadata?.fileCount).toBe(0);
    expect(result.metadata?.directoryCount).toBe(0);
  });

  it('should use default depth of 3 when not specified', async () => {
    const result = await tool.execute({ path: testDir });

    expect(result.success).toBe(true);
    expect(result.metadata?.depth).toBe(3);
  });
});
