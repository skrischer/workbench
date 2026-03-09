// src/tools/write-file.ts — Write File Tool

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { BaseTool } from './base.js';
import type { ToolResult, ToolContext } from '../types/index.js';

/**
 * Tool for writing content to a file with automatic parent directory creation.
 */
export class WriteFileTool extends BaseTool {
  readonly name = 'write_file';
  readonly description = 'Write content to a file. Creates parent directories automatically.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['path', 'content'],
  };

  async execute(input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    const path = input.path as string;
    const content = input.content as string;

    try {
      // Create parent directories if they don't exist
      const parentDir = dirname(path);
      await mkdir(parentDir, { recursive: true });

      // Write the file
      await writeFile(path, content, 'utf-8');

      return {
        success: true,
        output: `Successfully wrote ${content.length} characters to '${path}'`,
        metadata: {
          path,
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
        },
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: '',
        error: `Failed to write file '${path}': ${error.message}`,
      };
    }
  }
}
