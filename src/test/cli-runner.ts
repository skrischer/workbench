// src/test/cli-runner.ts

import { execFile } from 'node:child_process';
import path from 'node:path';

export interface CliRunnerOptions {
  args?: string[];
  env?: Record<string, string>;
  timeout?: number; // ms, default 30000
  cwd?: string;
}

export interface CliRunnerResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

/**
 * Run the workbench CLI as a child process.
 * Uses the compiled dist/cli/index.js binary.
 */
export async function runCli(options: CliRunnerOptions = {}): Promise<CliRunnerResult> {
  const {
    args = [],
    env = {},
    timeout = 30000,
    cwd,
  } = options;

  // Path to compiled CLI entry point (relative to project root)
  const cliPath = path.resolve(import.meta.dirname, '../../dist/cli/index.js');

  return new Promise((resolve) => {
    const child = execFile(
      'node',
      [cliPath, ...args],
      {
        env: { ...process.env, ...env },
        timeout,
        cwd,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      },
      (error, stdout, stderr) => {
        const timedOut = error?.killed === true;
        const exitCode = error ? (error as any).code ?? 1 : 0;
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: typeof exitCode === 'number' ? exitCode : 1,
          timedOut,
        });
      }
    );
  });
}
