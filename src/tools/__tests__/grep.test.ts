// src/tools/__tests__/grep.test.ts — Tests for GrepTool

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GrepTool } from '../grep.js';

describe('GrepTool', () => {
  let tool: GrepTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new GrepTool();
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `grep-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should find simple text matches', async () => {
    // Create test files
    await writeFile(join(testDir, 'file1.txt'), 'Hello world\nThis is a test\nHello again');
    await writeFile(join(testDir, 'file2.txt'), 'No match here\nJust some text');

    const result = await tool.execute({
      pattern: 'Hello',
      path: testDir,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('file1.txt:1');
    expect(result.output).toContain('Hello world');
    expect(result.output).toContain('file1.txt:3');
    expect(result.output).toContain('Hello again');
    expect(result.output).not.toContain('file2.txt');
    expect(result.metadata?.matchCount).toBe(2);
  });

  it('should support regex patterns', async () => {
    // Create test file with patterns
    await writeFile(
      join(testDir, 'code.ts'),
      'const foo = 123;\nconst bar = 456;\nlet baz = 789;\nvar qux = 0;'
    );

    // Search for variable declarations starting with const
    const result = await tool.execute({
      pattern: '^const ',
      path: testDir,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('const foo = 123;');
    expect(result.output).toContain('const bar = 456;');
    expect(result.output).not.toContain('let baz');
    expect(result.output).not.toContain('var qux');
    expect(result.metadata?.matchCount).toBe(2);
  });

  it('should include context lines', async () => {
    // Create test file
    await writeFile(
      join(testDir, 'test.txt'),
      'line 1\nline 2\nMATCH HERE\nline 4\nline 5\nline 6'
    );

    const result = await tool.execute({
      pattern: 'MATCH HERE',
      path: testDir,
      context_lines: 2,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('test.txt:3');
    expect(result.output).toContain('  | line 1'); // Context before
    expect(result.output).toContain('  | line 2'); // Context before
    expect(result.output).toContain('  > MATCH HERE'); // Match line
    expect(result.output).toContain('  | line 4'); // Context after
    expect(result.output).toContain('  | line 5'); // Context after
  });

  it('should filter by file type using include pattern', async () => {
    // Create files with different extensions
    await writeFile(join(testDir, 'file.ts'), 'TypeScript match');
    await writeFile(join(testDir, 'file.js'), 'JavaScript match');
    await writeFile(join(testDir, 'file.txt'), 'Text match');

    const result = await tool.execute({
      pattern: 'match',
      path: testDir,
      include: '*.ts',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('file.ts:1');
    expect(result.output).toContain('TypeScript match');
    expect(result.output).not.toContain('file.js');
    expect(result.output).not.toContain('file.txt');
    expect(result.metadata?.matchCount).toBe(1);
  });

  it('should respect max_results limit', async () => {
    // Create a file with many matches
    const lines: string[] = [];
    for (let i = 1; i <= 100; i++) {
      lines.push(`match line ${i}`);
    }
    await writeFile(join(testDir, 'many.txt'), lines.join('\n'));

    const result = await tool.execute({
      pattern: 'match',
      path: testDir,
      max_results: 10,
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.matchCount).toBe(10);
    expect(result.metadata?.totalMatches).toBeGreaterThan(10);
    expect(result.metadata?.wasTruncated).toBe(true);
    expect(result.output).toContain('showing first 10 matches');
  });

  it('should return empty result when no matches found', async () => {
    await writeFile(join(testDir, 'file.txt'), 'No matches in this file');

    const result = await tool.execute({
      pattern: 'xyz123',
      path: testDir,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('No matches found');
    expect(result.metadata?.matchCount).toBe(0);
  });

  it('should handle invalid regex pattern', async () => {
    const result = await tool.execute({
      pattern: '[invalid(regex',
      path: testDir,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid regex pattern');
  });

  it('should search nested directories', async () => {
    // Create nested structure
    await mkdir(join(testDir, 'subdir'));
    await writeFile(join(testDir, 'root.txt'), 'match in root');
    await writeFile(join(testDir, 'subdir', 'nested.txt'), 'match in nested');

    const result = await tool.execute({
      pattern: 'match',
      path: testDir,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('root.txt:1');
    expect(result.output).toContain('subdir/nested.txt:1');
    expect(result.metadata?.matchCount).toBe(2);
  });
});
