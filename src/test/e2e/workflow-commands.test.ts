import { describe, it, expect } from 'vitest';
import { runCli } from '../cli-runner.js';

describe('Workflow CLI Commands', () => {
  describe('Workflow Help', () => {
    it('workbench workflow --help should show available subcommands', async () => {
      const result = await runCli({
        args: ['workflow', '--help'],
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      
      // Should show subcommands
      const output = result.stdout.toLowerCase();
      expect(output).toMatch(/list|run/);
    });
  });

  describe('Workflow List', () => {
    it('workbench workflow list should show registered workflows', async () => {
      const result = await runCli({
        args: ['workflow', 'list'],
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      
      // Should contain the registered workflow IDs
      const output = result.stdout;
      expect(output).toContain('test-fixer');
      expect(output).toContain('code-reviewer');
      expect(output).toContain('refactor');
      expect(output).toContain('docs');
    });
  });

  describe('Workflow Run Help', () => {
    it('workbench workflow run --help should show run options', async () => {
      const result = await runCli({
        args: ['workflow', 'run', '--help'],
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      
      // Should contain usage/option information
      expect(result.stdout.length).toBeGreaterThan(50);
    });
  });

  describe('Error Handling', () => {
    it('workbench workflow run nonexistent-workflow should fail with error', async () => {
      const result = await runCli({
        args: ['workflow', 'run', 'nonexistent-workflow'],
        timeout: 5000,
      });

      // Should fail
      expect(result.exitCode).not.toBe(0);
      expect(result.timedOut).toBe(false);
      
      // Should contain error message about unknown workflow
      const output = result.stderr + result.stdout;
      expect(output.toLowerCase()).toMatch(/not found|unknown|invalid|does not exist/);
    });
  });

  describe('Status Command', () => {
    it('workbench status should show Workbench and version', async () => {
      const result = await runCli({
        args: ['status'],
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      
      // Should contain Workbench name and version info
      const output = result.stdout;
      expect(output).toContain('Workbench');
      expect(output).toMatch(/\d+\.\d+\.\d+/); // Version pattern
    });
  });
});
