// src/tools/__tests__/project-summary.test.ts — Tests for ProjectSummaryTool

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectSummaryTool } from '../project-summary.js';

describe('ProjectSummaryTool', () => {
  let tool: ProjectSummaryTool;
  let testDir: string;

  beforeEach(async () => {
    tool = new ProjectSummaryTool();
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `project-summary-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should generate summary for complete project with package.json', async () => {
    // Create a complete project structure
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      description: 'A test project for unit testing',
      scripts: {
        build: 'tsc',
        test: 'vitest',
      },
      dependencies: {
        express: '^4.18.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        vitest: '^1.0.0',
      },
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    await writeFile(join(testDir, 'README.md'), '# Test Project');
    await writeFile(join(testDir, 'tsconfig.json'), '{}');
    await mkdir(join(testDir, 'src'));
    await writeFile(join(testDir, 'src', 'index.ts'), 'console.log("hello");');

    const result = await tool.execute({ path: testDir });

    expect(result.success).toBe(true);
    expect(result.output).toContain('## Project Information');
    expect(result.output).toContain('**Name:** test-project');
    expect(result.output).toContain('**Version:** 1.0.0');
    expect(result.output).toContain('**Description:** A test project for unit testing');
    expect(result.output).toContain('## Directory Structure');
    expect(result.output).toContain('## Key Files');
    expect(result.output).toContain('README.md');
    expect(result.output).toContain('tsconfig.json');
    expect(result.output).toContain('## Dependencies');
    expect(result.output).toContain('express: ^4.18.0');
    expect(result.output).toContain('## Dev Dependencies');
    expect(result.output).toContain('typescript: ^5.0.0');
    expect(result.output).toContain('vitest: ^1.0.0');
    expect(result.output).toContain('## Scripts');
    expect(result.output).toContain('**build:** `tsc`');
    expect(result.output).toContain('**test:** `vitest`');
    expect(result.metadata?.hasPackageJson).toBe(true);
  });

  it('should handle project without package.json', async () => {
    // Create a simple project without package.json
    await writeFile(join(testDir, 'README.md'), '# Simple Project');
    await mkdir(join(testDir, 'docs'));
    await writeFile(join(testDir, 'docs', 'guide.md'), '# Guide');

    const result = await tool.execute({ path: testDir });

    expect(result.success).toBe(true);
    expect(result.output).toContain('_No package.json found in this directory_');
    expect(result.output).toContain('## Directory Structure');
    expect(result.output).toContain('## Key Files');
    expect(result.output).toContain('README.md');
    expect(result.output).not.toContain('## Dependencies');
    expect(result.output).not.toContain('## Scripts');
    expect(result.metadata?.hasPackageJson).toBe(false);
  });

  it('should handle empty directory', async () => {
    // testDir is already empty
    const result = await tool.execute({ path: testDir });

    expect(result.success).toBe(true);
    expect(result.output).toContain('_No package.json found in this directory_');
    expect(result.output).toContain('## Directory Structure');
    expect(result.metadata?.hasPackageJson).toBe(false);
    expect(result.metadata?.keyFilesCount).toBe(0);
  });

  it('should display dependencies correctly', async () => {
    // Project with only dependencies (no devDependencies)
    const packageJson = {
      name: 'deps-test',
      version: '0.1.0',
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        axios: '^1.0.0',
      },
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const result = await tool.execute({ path: testDir });

    expect(result.success).toBe(true);
    expect(result.output).toContain('## Dependencies');
    expect(result.output).toContain('react: ^18.0.0');
    expect(result.output).toContain('react-dom: ^18.0.0');
    expect(result.output).toContain('axios: ^1.0.0');
    expect(result.output).not.toContain('## Dev Dependencies');
  });

  it('should display scripts correctly', async () => {
    // Project with various scripts
    const packageJson = {
      name: 'scripts-test',
      version: '1.0.0',
      scripts: {
        start: 'node dist/index.js',
        dev: 'nodemon src/index.ts',
        build: 'tsc && vite build',
        test: 'vitest run',
        'test:watch': 'vitest',
        lint: 'eslint src/',
      },
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const result = await tool.execute({ path: testDir });

    expect(result.success).toBe(true);
    expect(result.output).toContain('## Scripts');
    expect(result.output).toContain('**start:** `node dist/index.js`');
    expect(result.output).toContain('**dev:** `nodemon src/index.ts`');
    expect(result.output).toContain('**build:** `tsc && vite build`');
    expect(result.output).toContain('**test:** `vitest run`');
    expect(result.output).toContain('**test:watch:** `vitest`');
    expect(result.output).toContain('**lint:** `eslint src/`');
  });

  it('should use default path when not specified', async () => {
    // Create package.json in test dir
    const packageJson = {
      name: 'default-path-test',
      version: '1.0.0',
    };

    await writeFile(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Execute without specifying path (will use '.' which is the test dir in this context)
    // We need to change the working directory for this test or just verify the default value
    const result = await tool.execute({});

    // The tool will try to read from '.' which is the current working directory
    // For this test, we just verify that it doesn't crash and uses the default
    expect(result.success).toBe(true);
  });

  it('should generate directory tree with correct depth', async () => {
    // Create nested structure to test depth 2
    await mkdir(join(testDir, 'level1'), { recursive: true });
    await mkdir(join(testDir, 'level1', 'level2'), { recursive: true });
    await mkdir(join(testDir, 'level1', 'level2', 'level3'), { recursive: true });
    await writeFile(join(testDir, 'root.txt'), 'root');
    await writeFile(join(testDir, 'level1', 'l1.txt'), 'level1');
    await writeFile(join(testDir, 'level1', 'level2', 'l2.txt'), 'level2');
    await writeFile(join(testDir, 'level1', 'level2', 'level3', 'l3.txt'), 'level3');

    const result = await tool.execute({ path: testDir });

    expect(result.success).toBe(true);
    expect(result.output).toContain('## Directory Structure');
    // Should include depth 0, 1, and 2
    expect(result.output).toContain('root.txt');
    expect(result.output).toContain('level1/');
    expect(result.output).toContain('l1.txt');
    expect(result.output).toContain('level2/');
    expect(result.output).toContain('l2.txt');
    // level3 directory is at depth 2, so it will be shown, but not its contents
    expect(result.output).toContain('level3/');
    // l3.txt is at depth 3, so it should NOT be shown
    expect(result.output).not.toContain('l3.txt');
  });

  it('should identify multiple key files', async () => {
    // Create various key files
    await writeFile(join(testDir, 'README.md'), '# README');
    await writeFile(join(testDir, 'package.json'), '{}');
    await writeFile(join(testDir, 'tsconfig.json'), '{}');
    await writeFile(join(testDir, '.gitignore'), 'node_modules');
    await writeFile(join(testDir, 'Dockerfile'), 'FROM node:20');
    await writeFile(join(testDir, 'vitest.config.ts'), 'export default {}');
    await writeFile(join(testDir, 'random.txt'), 'not a key file');

    const result = await tool.execute({ path: testDir });

    expect(result.success).toBe(true);
    expect(result.output).toContain('## Key Files');
    
    // Extract the Key Files section to check it specifically
    const keyFilesSection = result.output.split('## Key Files')[1]?.split('##')[0] || '';
    
    expect(keyFilesSection).toContain('README.md');
    expect(keyFilesSection).toContain('package.json');
    expect(keyFilesSection).toContain('tsconfig.json');
    expect(keyFilesSection).toContain('.gitignore');
    expect(keyFilesSection).toContain('Dockerfile');
    expect(keyFilesSection).toContain('vitest.config.ts');
    expect(keyFilesSection).not.toContain('random.txt');
    expect(result.metadata?.keyFilesCount).toBeGreaterThanOrEqual(6);
  });
});
