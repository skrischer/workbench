// src/tools/read-file.ts — Read File Tool

import { readFile } from 'node:fs/promises';
import { BaseTool } from './base.js';
import type { ToolResult, ToolContext } from '../types/index.js';

/**
 * Tool for reading file contents with optional offset/limit support.
 */
export class ReadFileTool extends BaseTool {
  readonly name = 'read_file';
  readonly description = 'Read file contents as string. Supports offset/limit for large files.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read',
      },
      offset: {
        type: 'number',
        description: 'Starting line number (1-based, optional)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read (optional)',
      },
    },
    required: ['path'],
  };

  async execute(input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    const path = input.path as string;
    const offset = input.offset as number | undefined;
    const limit = input.limit as number | undefined;

    try {
      const content = await readFile(path, 'utf-8');
      const lines = content.split('\n');

      // Apply offset and limit if provided
      let resultLines = lines;
      if (offset !== undefined || limit !== undefined) {
        const startIndex = offset ? offset - 1 : 0; // Convert 1-based to 0-based
        const endIndex = limit ? startIndex + limit : undefined;
        resultLines = lines.slice(startIndex, endIndex);
      }

      const resultContent = resultLines.join('\n');

      return {
        success: true,
        output: resultContent,
        metadata: {
          path,
          totalLines: lines.length,
          returnedLines: resultLines.length,
          offset,
          limit,
        },
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: '',
        error: `Failed to read file '${path}': ${error.message}`,
      };
    }
  }
}
