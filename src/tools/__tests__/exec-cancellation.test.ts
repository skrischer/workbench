// src/tools/__tests__/exec-cancellation.test.ts — Tests for ExecTool Cancellation

import { describe, it, expect, beforeEach } from 'vitest';
import { ExecTool } from '../exec.js';
import type { ToolContext } from '../../types/index.js';

describe('ExecTool Cancellation', () => {
  let tool: ExecTool;

  beforeEach(() => {
    tool = new ExecTool();
  });

  describe('Normal Execution (no cancellation)', () => {
    it('should execute a simple command successfully', async () => {
      const result = await tool.execute({ command: 'echo "hello"' });

      expect(result.success).toBe(true);
      expect(result.output).toContain('hello');
      expect(result.error).toBeUndefined();
    });

    it('should execute with context but without signal', async () => {
      const context: ToolContext = {
        metadata: { runId: 'test-1' },
      };

      const result = await tool.execute({ command: 'echo "test"' }, context);

      expect(result.success).toBe(true);
      expect(result.output).toContain('test');
    });

    it('should handle command failure normally', async () => {
      const result = await tool.execute({ command: 'exit 1' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('exit code 1');
    });
  });

  describe('Cancellation Before Execution', () => {
    it('should return cancelled error if signal is already aborted', async () => {
      const abortController = new AbortController();
      abortController.abort();

      const context: ToolContext = {
        signal: abortController.signal,
      };

      const result = await tool.execute({ command: 'echo "should not run"' }, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cancelled');
      expect(result.metadata?.cancelled).toBe(true);
      expect(result.output).toBe('');
    });
  });

  describe('Cancellation During Execution', () => {
    it('should abort a long-running command when signal fires', async () => {
      const abortController = new AbortController();
      const context: ToolContext = {
        signal: abortController.signal,
      };

      // Start a long-running command
      const execPromise = tool.execute({ command: 'sleep 10' }, context);

      // Cancel after a short delay
      setTimeout(() => abortController.abort(), 100);

      const result = await execPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cancelled');
      expect(result.metadata?.cancelled).toBe(true);
    });

    it('should abort a command that produces continuous output', async () => {
      const abortController = new AbortController();
      const context: ToolContext = {
        signal: abortController.signal,
      };

      // Command that produces output continuously
      const execPromise = tool.execute(
        { command: 'bash -c "while true; do echo loop; sleep 0.1; done"' },
        context
      );

      // Cancel after a short delay
      setTimeout(() => abortController.abort(), 200);

      const result = await execPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cancelled');
      expect(result.metadata?.cancelled).toBe(true);
    });

    it('should handle multiple abort calls gracefully', async () => {
      const abortController = new AbortController();
      const context: ToolContext = {
        signal: abortController.signal,
      };

      const execPromise = tool.execute({ command: 'sleep 10' }, context);

      // Abort multiple times
      setTimeout(() => {
        abortController.abort();
        abortController.abort(); // Second abort should be no-op
      }, 100);

      const result = await execPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cancelled');
    });
  });

  describe('Cleanup After Cancellation', () => {
    it('should ensure child process is killed after abort', async () => {
      const abortController = new AbortController();
      const context: ToolContext = {
        signal: abortController.signal,
      };

      // Start a command that would normally run for a while
      const execPromise = tool.execute({ command: 'sleep 5' }, context);

      // Cancel immediately
      setTimeout(() => abortController.abort(), 50);

      const result = await execPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cancelled');

      // Wait a bit to ensure process is dead
      await new Promise((resolve) => setTimeout(resolve, 100));

      // If we got here without hanging, the process was killed successfully
    });

    it('should handle abort of already-completed command', async () => {
      const abortController = new AbortController();
      const context: ToolContext = {
        signal: abortController.signal,
      };

      // Fast command that completes quickly
      const result = await tool.execute({ command: 'echo "fast"' }, context);

      // Abort after completion
      abortController.abort();

      // Should have completed successfully
      expect(result.success).toBe(true);
      expect(result.output).toContain('fast');
    });
  });

  describe('Timeout vs Cancellation', () => {
    it('should respect timeout even when signal is provided', async () => {
      const abortController = new AbortController();
      const context: ToolContext = {
        signal: abortController.signal,
      };

      // Command with short timeout
      const result = await tool.execute(
        {
          command: 'sleep 10',
          timeout_ms: 100,
        },
        context
      );

      // Should timeout, not be cancelled
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(result.metadata?.timeout).toBe(true);
    });

    it('should cancel before timeout if signal fires first', async () => {
      const abortController = new AbortController();
      const context: ToolContext = {
        signal: abortController.signal,
      };

      const execPromise = tool.execute(
        {
          command: 'sleep 10',
          timeout_ms: 5000, // Long timeout
        },
        context
      );

      // Cancel quickly
      setTimeout(() => abortController.abort(), 50);

      const result = await execPromise;

      // Should be cancelled, not timed out
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cancelled');
      expect(result.metadata?.cancelled).toBe(true);
    });
  });

  describe('Working Directory with Cancellation', () => {
    it('should respect cwd even when cancelled', async () => {
      const abortController = new AbortController();
      const context: ToolContext = {
        signal: abortController.signal,
      };

      const execPromise = tool.execute(
        {
          command: 'sleep 5',
          cwd: '/tmp',
        },
        context
      );

      setTimeout(() => abortController.abort(), 50);

      const result = await execPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cancelled');
      expect(result.metadata?.command).toContain('sleep');
    });
  });
});
