// src/tools/exec.ts — Execute Shell Command Tool
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseTool } from './base.js';
const execAsync = promisify(exec);
/**
 * Tool for executing shell commands with timeout and cwd support.
 */
export class ExecTool extends BaseTool {
    name = 'exec';
    description = 'Execute a shell command and return stdout/stderr combined.';
    inputSchema = {
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
    async execute(input) {
        const command = input.command;
        const cwd = input.cwd;
        const timeoutMs = input.timeout_ms ?? 30000;
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                timeout: timeoutMs,
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            });
            // Combine stdout and stderr
            const combinedOutput = (stdout + stderr).trim();
            return {
                success: true,
                output: combinedOutput,
                metadata: {
                    exitCode: 0,
                    command,
                    cwd,
                },
            };
        }
        catch (err) {
            const error = err;
            // Handle timeout
            if (error.killed && error.signal === 'SIGTERM') {
                return {
                    success: false,
                    output: '',
                    error: `Command timed out after ${timeoutMs}ms: ${command}`,
                    metadata: {
                        exitCode: -1,
                        timeout: true,
                        command,
                    },
                };
            }
            // Handle non-zero exit code
            if (error.code !== undefined) {
                const combinedOutput = ((error.stdout || '') + (error.stderr || '')).trim();
                return {
                    success: false,
                    output: combinedOutput,
                    error: `Command failed with exit code ${error.code}: ${command}`,
                    metadata: {
                        exitCode: error.code,
                        command,
                        cwd,
                    },
                };
            }
            // Other errors (e.g., command not found)
            return {
                success: false,
                output: '',
                error: `Failed to execute command '${command}': ${error.message}`,
                metadata: {
                    exitCode: -1,
                    command,
                },
            };
        }
    }
}
