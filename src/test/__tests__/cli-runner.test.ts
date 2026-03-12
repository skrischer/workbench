// src/test/__tests__/cli-runner.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { runCli } from '../cli-runner.js';
import fs from 'node:fs';
import path from 'node:path';

describe('cli-runner', () => {
  beforeAll(() => {
    // Ensure dist/cli/index.js exists before running tests
    const cliPath = path.resolve(import.meta.dirname, '../../../dist/tui/index.js');
    if (!fs.existsSync(cliPath)) {
      throw new Error(
        `CLI binary not found at ${cliPath}. Run 'npm run build' before running tests.`
      );
    }
  });

  it('should run --help and return exit code 0', async () => {
    const result = await runCli({ args: ['--help'] });

    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    // Check that stdout contains something related to the CLI
    expect(result.stdout.toLowerCase()).toMatch(/workbench|usage|help|options/i);
  });

  it('should return non-zero exit code for nonexistent command', async () => {
    const result = await runCli({ args: ['nonexistent-command'] });

    expect(result.exitCode).not.toBe(0);
    expect(result.timedOut).toBe(false);
  });

  it('should pass through environment variables', async () => {
    const testEnvValue = 'test-value-12345';
    const result = await runCli({
      args: ['--help'],
      env: { TEST_ENV_VAR: testEnvValue },
    });

    // Since we can't directly assert env var presence in the child,
    // we verify that the CLI ran successfully with custom env
    expect(result.exitCode).toBe(0);
    // The child process should have inherited the env var
    // (this is a basic smoke test - a more comprehensive test
    // would require the CLI to echo env vars)
  });

  it('should timeout and set timedOut flag', async () => {
    // Spawn a command that sleeps longer than the timeout
    // We'll use a very short timeout and rely on the CLI taking longer
    const result = await runCli({
      args: ['--help'],
      timeout: 1, // 1ms - virtually guaranteed to timeout
    });

    // With such a short timeout, it should kill the process
    expect(result.timedOut).toBe(true);
  }, 10000); // Give the test itself 10s to complete

  it('should capture stdout and stderr separately', async () => {
    const result = await runCli({ args: ['--help'] });

    // stdout should contain help text
    expect(result.stdout).toBeTruthy();
    expect(typeof result.stdout).toBe('string');
    
    // stderr may or may not be empty depending on the CLI
    expect(typeof result.stderr).toBe('string');
  });

  it('should allow custom cwd', async () => {
    const result = await runCli({
      args: ['--help'],
      cwd: '/tmp',
    });

    // Should still work even with different cwd
    expect(result.exitCode).toBe(0);
  });
});
