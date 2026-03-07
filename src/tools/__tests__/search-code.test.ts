// src/tools/__tests__/search-code.test.ts — Tests for SearchCodeTool

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SearchCodeTool } from '../search-code.js';

describe('SearchCodeTool', () => {
  let tool: SearchCodeTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new SearchCodeTool();
    // Create a unique temp directory for each test
    testDir = join(
      tmpdir(),
      `search-code-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should find function declarations', async () => {
    // Create test file with function
    const testFile = join(testDir, 'test.ts');
    await writeFile(
      testFile,
      `
export function myFunction(arg: string) {
  console.log(arg);
  return arg.toUpperCase();
}

function anotherFunction() {
  return 42;
}
`
    );

    const result = await tool.execute({
      query: 'myFunction',
      path: testDir,
      type: 'function',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('myFunction');
    expect(result.output).toContain('test.ts:2');
    expect(result.output).toContain('console.log');
    expect(result.metadata?.matchCount).toBe(1);
  });

  it('should find class declarations', async () => {
    // Create test file with class
    const testFile = join(testDir, 'classes.ts');
    await writeFile(
      testFile,
      `
export class MyClass {
  private value: number;
  
  constructor(val: number) {
    this.value = val;
  }
}

class AnotherClass {}
`
    );

    const result = await tool.execute({
      query: 'MyClass',
      path: testDir,
      type: 'class',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('MyClass');
    expect(result.output).toContain('classes.ts:2');
    expect(result.output).toContain('private value');
    expect(result.metadata?.matchCount).toBe(1);
  });

  it('should find interface declarations', async () => {
    // Create test file with interface
    const testFile = join(testDir, 'types.ts');
    await writeFile(
      testFile,
      `
export interface User {
  id: string;
  name: string;
  email: string;
}

interface AdminUser extends User {
  permissions: string[];
}
`
    );

    const result = await tool.execute({
      query: 'User',
      path: testDir,
      type: 'interface',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('User');
    expect(result.output).toContain('types.ts:2');
    expect(result.output).toContain('id: string');
    expect(result.metadata?.matchCount).toBe(1);
  });

  it('should filter by type', async () => {
    // Create test file with multiple constructs
    const testFile = join(testDir, 'mixed.ts');
    await writeFile(
      testFile,
      `
export class TestItem {}
export interface TestItem {}
export type TestItem = string;
export function TestItem() {}
`
    );

    // Search for only types
    const result = await tool.execute({
      query: 'TestItem',
      path: testDir,
      type: 'type',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('TestItem');
    expect(result.output).toContain('type TestItem');
    // Should only find the type declaration, not class/interface/function
    expect(result.metadata?.matchCount).toBe(1);
  });

  it('should return no matches when nothing is found', async () => {
    // Create test file
    const testFile = join(testDir, 'empty.ts');
    await writeFile(testFile, 'const x = 42;\n');

    const result = await tool.execute({
      query: 'NonExistent',
      path: testDir,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('No matches found');
    expect(result.output).toContain('NonExistent');
    expect(result.metadata?.matchCount).toBe(0);
  });

  it('should find multiple matches across files', async () => {
    // Create multiple test files
    await writeFile(
      join(testDir, 'file1.ts'),
      `
export function processData(data: string) {
  return data;
}
`
    );

    await writeFile(
      join(testDir, 'file2.ts'),
      `
import { processData } from './file1';

export const processData = (data: number) => {
  return data * 2;
};
`
    );

    const result = await tool.execute({
      query: 'processData',
      path: testDir,
      type: 'all',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('processData');
    // Should find at least 2 matches (function in file1, const in file2)
    expect(result.metadata?.matchCount).toBeGreaterThanOrEqual(2);
    expect(result.output).toContain('file1.ts');
    expect(result.output).toContain('file2.ts');
  });

  it('should support arrow functions', async () => {
    // Create test file with arrow functions
    const testFile = join(testDir, 'arrow.ts');
    await writeFile(
      testFile,
      `
const myArrowFunc = (x: number) => {
  return x * 2;
};

export const anotherArrow = (a: string, b: string) => a + b;
`
    );

    const result = await tool.execute({
      query: 'myArrowFunc',
      path: testDir,
      type: 'function',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('myArrowFunc');
    expect(result.output).toContain('arrow.ts');
    expect(result.metadata?.matchCount).toBe(1);
  });

  it('should ignore files in node_modules', async () => {
    // Create node_modules directory
    const nodeModulesDir = join(testDir, 'node_modules');
    await mkdir(nodeModulesDir, { recursive: true });
    await writeFile(
      join(nodeModulesDir, 'library.js'),
      'export function ignoredFunction() {}'
    );

    // Create normal file
    await writeFile(
      join(testDir, 'index.ts'),
      'export function ignoredFunction() {}'
    );

    const result = await tool.execute({
      query: 'ignoredFunction',
      path: testDir,
    });

    expect(result.success).toBe(true);
    // Should only find the one in index.ts, not in node_modules
    expect(result.metadata?.matchCount).toBe(1);
    expect(result.output).toContain('index.ts');
    expect(result.output).not.toContain('node_modules');
  });
});
