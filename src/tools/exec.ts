// src/tools/exec.ts — Execute Shell Command Tool

import { exec } from 'node:child_process';
import { BaseTool } from './base.js';
import type { ToolResult, ToolContext } from '../types/index.js';

/**
 * Tool for executing shell commands with timeout, cwd, and cancellation support.
 */
export class ExecTool extends BaseTool {
  readonly name = 'exec';
  readonly description = 'Execute a shell command and return stdout/stderr combined.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Shell command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory (optional)',
      },
      timeout_ms: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)',
      },
    },
    required: ['command'],
  };

  async execute(input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    const command = input.command as string;
    const cwd = input.cwd as string | undefined;
    const timeoutMs = (input.timeout_ms as number | undefined) ?? 30000;
    const signal = context?.signal;

    // Check if already cancelled before starting
    if (signal?.aborted) {
      return {
        success: false,
        output: '',
        error: 'Cancelled',
        metadata: {
          exitCode: -1,
          cancelled: true,
          command,
        },
      };
    }

    return new Promise((resolve) => {
      const child = exec(
        command,
        {
          cwd,
          timeout: timeoutMs,
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        },
        (error, stdout, stderr) => {
          // Clean up abort listener
          if (signal && abortHandler) {
            signal.removeEventListener('abort', abortHandler);
          }

          // If killed by abort handler, it's already resolved
          if (wasAborted) {
            return;
          }

          // Combine stdout and stderr
          const combinedOutput = (stdout + stderr).trim();

          if (!error) {
            resolve({
              success: true,
              output: combinedOutput,
              metadata: {
                exitCode: 0,
                command,
                cwd,
              },
            });
            return;
          }

          // Handle timeout
          if (error.killed && error.signal === 'SIGTERM') {
            resolve({
              success: false,
              output: '',
              error: `Command timed out after ${timeoutMs}ms: ${command}`,
              metadata: {
                exitCode: -1,
                timeout: true,
                command,
              },
            });
            return;
          }

          // Handle non-zero exit code
          if (error.code !== undefined) {
            resolve({
              success: false,
              output: combinedOutput,
              error: `Command failed with exit code ${error.code}: ${command}`,
              metadata: {
                exitCode: error.code,
                command,
                cwd,
              },
            });
            return;
          }

          // Other errors (e.g., command not found)
          resolve({
            success: false,
            output: '',
            error: `Failed to execute command '${command}': ${error.message}`,
            metadata: {
              exitCode: -1,
              command,
            },
          });
        }
      );

      // Set up abort handler
      let wasAborted = false;
      let abortHandler: (() => void) | undefined;

      if (signal) {
        abortHandler = () => {
          wasAborted = true;

          // Kill the child process
          if (child.pid) {
            try {
              child.kill('SIGTERM');
            } catch (err) {
              // Process might already be dead
            }
          }

          resolve({
            success: false,
            output: '',
            error: 'Cancelled',
            metadata: {
              exitCode: -1,
              cancelled: true,
              command,
            },
          });
        };

        signal.addEventListener('abort', abortHandler);
      }
    });
  }
}
