// src/git/dod-runner.ts — Definition of Done Runner

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(exec);

/** Result of a single DoD check command */
export interface CheckResult {
  command: string;
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/** Overall DoD result */
export interface DodResult {
  passed: boolean;
  checks: CheckResult[];
  totalDurationMs: number;
}

/** DoD configuration from project config */
export interface DodConfig {
  dod?: string[];
  pre_dod?: string[];
}

/**
 * DodRunner — Executes Definition of Done checks before run completion.
 * Loads DoD commands from project config and runs them sequentially.
 */
export class DodRunner {
  private results: CheckResult[] = [];
  private startTime = 0;

  /**
   * Load DoD configuration from .workbench.json or workbench.json
   * @param cwd - Working directory (project root)
   * @returns DoD config or null if no config found
   */
  async loadConfig(cwd: string): Promise<DodConfig | null> {
    const configFiles = ['.workbench.json', 'workbench.json'];

    for (const file of configFiles) {
      const configPath = join(cwd, file);
      try {
        await access(configPath);
        const content = await readFile(configPath, 'utf-8');
        const config = JSON.parse(content) as DodConfig;
        return config;
      } catch (err) {
        // File not found or not readable, try next
        continue;
      }
    }

    return null;
  }

  /**
   * Run all DoD checks sequentially.
   * Executes pre_dod commands first, then dod commands.
   * Stops at first failure.
   * @param cwd - Working directory
   * @param config - DoD configuration
   */
  async runChecks(cwd: string, config: DodConfig): Promise<void> {
    this.results = [];
    this.startTime = Date.now();

    // Combine pre_dod and dod commands in order
    const preDodCommands = config.pre_dod || [];
    const dodCommands = config.dod || [];
    const allCommands = [...preDodCommands, ...dodCommands];

    if (allCommands.length === 0) {
      console.warn('No DoD commands configured. Skipping DoD checks.');
      return;
    }

    for (const command of allCommands) {
      const checkStart = Date.now();
      let passed = false;
      let exitCode = 0;
      let stdout = '';
      let stderr = '';

      try {
        const result = await execAsync(command, {
          cwd,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        });
        stdout = result.stdout;
        stderr = result.stderr;
        passed = true;
        exitCode = 0;
      } catch (err: any) {
        exitCode = err.code || 1;
        stdout = err.stdout || '';
        stderr = err.stderr || err.message || '';
        passed = false;
      }

      const durationMs = Date.now() - checkStart;

      const checkResult: CheckResult = {
        command,
        passed,
        exitCode,
        stdout,
        stderr,
        durationMs,
      };

      this.results.push(checkResult);

      // Stop at first failure
      if (!passed) {
        break;
      }
    }
  }

  /**
   * Get DoD results
   * @returns Structured DoD result
   */
  getResults(): DodResult {
    const totalDurationMs = Date.now() - this.startTime;
    const passed = this.results.length > 0 && this.results.every((r) => r.passed);

    return {
      passed,
      checks: this.results,
      totalDurationMs,
    };
  }

  /**
   * Execute full DoD workflow: load config, run checks, return results.
   * Convenience method that combines loadConfig, runChecks, and getResults.
   * @param cwd - Working directory
   * @returns DoD result, or null if no config found
   */
  async execute(cwd: string): Promise<DodResult | null> {
    const config = await this.loadConfig(cwd);

    if (!config) {
      console.warn('No DoD configuration found (.workbench.json or workbench.json). Skipping DoD checks.');
      return null;
    }

    await this.runChecks(cwd, config);
    return this.getResults();
  }
}
