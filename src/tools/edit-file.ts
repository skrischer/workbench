// src/tools/edit-file.ts — Edit File Tool

import { readFile, writeFile } from 'node:fs/promises';
import { BaseTool } from './base.js';
import type { ToolResult, ToolContext } from '../types/index.js';

/**
 * Tool for editing files by replacing exact string matches.
 * Requires exactly one match to proceed (ambiguity protection).
 */
export class EditFileTool extends BaseTool {
  readonly name = 'edit_file';
  readonly description =
    'Replace old_string with new_string in a file. Fails if old_string is not found or appears multiple times.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit',
      },
      old_string: {
        type: 'string',
        description: 'Exact string to find and replace',
      },
      new_string: {
        type: 'string',
        description: 'String to replace old_string with',
      },
    },
    required: ['path', 'old_string', 'new_string'],
  };

  async execute(input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    const path = input.path as string;
    const oldString = input.old_string as string;
    const newString = input.new_string as string;

    try {
      // Read the file
      const content = await readFile(path, 'utf-8');

      // Count occurrences of old_string
      const matches = content.split(oldString).length - 1;

      if (matches === 0) {
        return {
          success: false,
          output: '',
          error: `String not found in file '${path}': "${oldString}"`,
        };
      }

      if (matches > 1) {
        return {
          success: false,
          output: '',
          error: `Ambiguous replacement: "${oldString}" found ${matches} times in '${path}'. Must have exactly one match.`,
        };
      }

      // Exactly one match — proceed with replacement
      const newContent = content.replace(oldString, newString);

      // Write back to file
      await writeFile(path, newContent, 'utf-8');

      return {
        success: true,
        output: `Successfully replaced "${oldString}" with "${newString}" in ${path}`,
        metadata: {
          path,
          oldLength: oldString.length,
          newLength: newString.length,
        },
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: '',
        error: `Failed to edit file '${path}': ${error.message}`,
      };
    }
  }
}
