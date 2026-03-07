// src/git/__tests__/dod-runner.test.ts — Tests for DoD Runner

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DodRunner, type DodConfig } from '../dod-runner.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('DodRunner', () => {
  let testDir: string;
  let runner: DodRunner;

  beforeEach(async () => {
    // Create temp test directory
    testDir = join(tmpdir(), `dod-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    runner = new DodRunner();
  });

  afterEach(async () => {
    // Cleanup
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should pass when all checks succeed', async () => {
    const config: DodConfig = {
      pre_dod: ['echo "pre check ok"'],
      dod: ['echo "dod check ok"', 'exit 0'],
    };

    await runner.runChecks(testDir, config);
    const result = runner.getResults();

    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(3);
    expect(result.checks[0].passed).toBe(true);
    expect(result.checks[1].passed).toBe(true);
    expect(result.checks[2].passed).toBe(true);
  });

  it('should stop at first failure and not run subsequent commands', async () => {
    const config: DodConfig = {
      dod: [
        'echo "first ok"',
        'exit 1', // This fails
        'echo "should not run"', // This should not execute
      ],
    };

    await runner.runChecks(testDir, config);
    const result = runner.getResults();

    expect(result.passed).toBe(false);
    expect(result.checks).toHaveLength(2); // Only first two commands run
    expect(result.checks[0].passed).toBe(true);
    expect(result.checks[1].passed).toBe(false);
    expect(result.checks[1].exitCode).toBe(1);
  });

  it('should return null when no config file exists', async () => {
    const config = await runner.loadConfig(testDir);
    expect(config).toBeNull();
  });

  it('should load config from .workbench.json', async () => {
    const configData: DodConfig = {
      dod: ['echo "test"'],
      pre_dod: ['echo "pre"'],
    };
    const configPath = join(testDir, '.workbench.json');
    await writeFile(configPath, JSON.stringify(configData));

    const config = await runner.loadConfig(testDir);
    expect(config).not.toBeNull();
    expect(config?.dod).toEqual(['echo "test"']);
    expect(config?.pre_dod).toEqual(['echo "pre"']);
  });

  it('should load config from workbench.json if .workbench.json does not exist', async () => {
    const configData: DodConfig = {
      dod: ['echo "test2"'],
    };
    const configPath = join(testDir, 'workbench.json');
    await writeFile(configPath, JSON.stringify(configData));

    const config = await runner.loadConfig(testDir);
    expect(config).not.toBeNull();
    expect(config?.dod).toEqual(['echo "test2"']);
  });

  it('should run pre_dod before dod commands', async () => {
    // Create a file to track execution order
    const orderFile = join(testDir, 'order.txt');

    const config: DodConfig = {
      pre_dod: [`echo "pre" >> ${orderFile}`],
      dod: [`echo "dod" >> ${orderFile}`],
    };

    await runner.runChecks(testDir, config);
    const result = runner.getResults();

    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(2);
    expect(result.checks[0].command).toContain('pre');
    expect(result.checks[1].command).toContain('dod');
  });

  it('should capture stdout and stderr correctly', async () => {
    const config: DodConfig = {
      dod: [
        'echo "stdout message"',
        'echo "stderr message" >&2',
      ],
    };

    await runner.runChecks(testDir, config);
    const result = runner.getResults();

    expect(result.checks[0].stdout).toContain('stdout message');
    expect(result.checks[1].stderr).toContain('stderr message');
  });

  it('should report correct exit codes', async () => {
    const config: DodConfig = {
      dod: [
        'exit 0',
        'exit 42',
      ],
    };

    await runner.runChecks(testDir, config);
    const result = runner.getResults();

    expect(result.checks[0].exitCode).toBe(0);
    expect(result.checks[0].passed).toBe(true);
    expect(result.checks[1].exitCode).toBe(42);
    expect(result.checks[1].passed).toBe(false);
  });

  it('should track timing correctly', async () => {
    const config: DodConfig = {
      dod: ['sleep 0.1', 'echo "done"'],
    };

    await runner.runChecks(testDir, config);
    const result = runner.getResults();

    expect(result.totalDurationMs).toBeGreaterThan(0);
    expect(result.checks[0].durationMs).toBeGreaterThan(0);
    expect(result.checks[1].durationMs).toBeGreaterThan(0);
  });

  it('should handle empty dod and pre_dod gracefully', async () => {
    const config: DodConfig = {};

    await runner.runChecks(testDir, config);
    const result = runner.getResults();

    expect(result.checks).toHaveLength(0);
    expect(result.passed).toBe(false); // No checks means not passed
  });

  it('should execute full workflow with execute() method', async () => {
    const configData: DodConfig = {
      dod: ['echo "test"'],
    };
    const configPath = join(testDir, '.workbench.json');
    await writeFile(configPath, JSON.stringify(configData));

    const result = await runner.execute(testDir);

    expect(result).not.toBeNull();
    expect(result?.passed).toBe(true);
    expect(result?.checks).toHaveLength(1);
  });

  it('should return null from execute() when no config exists', async () => {
    const result = await runner.execute(testDir);
    expect(result).toBeNull();
  });
});
