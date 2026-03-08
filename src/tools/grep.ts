// src/tools/grep.ts — Grep Tool for Regex-based Search

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BaseTool } from './base.js';
import { walkDirectory, shouldIgnore } from './utils/ignore.js';
import type { ToolResult } from '../types/index.js';

/**
 * Result of a single grep match.
 */
interface GrepMatch {
  file: string;
  lineNumber: number;
  line: string;
  contextBefore: string[];
  contextAfter: string[];
}

/**
 * Tool for searching files using regex patterns.
 */
export class GrepTool extends BaseTool {
  readonly name = 'grep';
  readonly description = 'Search files recursively using regex patterns. Returns matches with line numbers and optional context.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Regex pattern to search for',
      },
      path: {
        type: 'string',
        description: 'Starting directory path (default: ".")',
        default: '.',
      },
      include: {
        type: 'string',
        description: 'File type filter (e.g., "*.ts", "*.js")',
      },
      context_lines: {
        type: 'number',
        description: 'Number of context lines before and after each match (default: 0)',
        default: 0,
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of matches to return (default: 50)',
        default: 50,
      },
    },
    required: ['pattern'],
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const pattern = input.pattern as string;
    const path = (input.path as string | undefined) || '.';
    const include = input.include as string | undefined;
    const contextLines = (input.context_lines as number | undefined) || 0;
    const maxResults = (input.max_results as number | undefined) || 50;

    try {
      // Compile the regex pattern
      let regex: RegExp;
      try {
        regex = new RegExp(pattern);
      } catch (err) {
        const error = err as Error;
        return {
          success: false,
          output: '',
          error: `Invalid regex pattern: ${error.message}`,
        };
      }

      const resolvedPath = resolve(path);
      const matches: GrepMatch[] = [];
      let filesSearched = 0;

      // Walk the directory tree
      for await (const entry of walkDirectory(resolvedPath)) {
        // Only process files
        if (entry.type !== 'file') {
          continue;
        }

        // Apply include filter if provided
        if (include && !this.matchesPattern(entry.name, include)) {
          continue;
        }

        // Search the file
        filesSearched++;
        const fileMatches = await this.searchFile(entry.path, regex, contextLines);
        matches.push(...fileMatches);

        // Stop if we've hit max results
        if (matches.length >= maxResults) {
          break;
        }
      }

      // Truncate to max_results
      const truncatedMatches = matches.slice(0, maxResults);
      const wasTruncated = matches.length > maxResults;

      // Format output
      const output = this.formatOutput(truncatedMatches, resolvedPath, wasTruncated);

      return {
        success: true,
        output,
        metadata: {
          pattern,
          path: resolvedPath,
          filesSearched,
          matchCount: truncatedMatches.length,
          totalMatches: matches.length,
          wasTruncated,
        },
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: '',
        error: `Grep failed: ${error.message}`,
      };
    }
  }

  /**
   * Search a single file for matches.
   */
  private async searchFile(
    filePath: string,
    regex: RegExp,
    contextLines: number
  ): Promise<GrepMatch[]> {
    const matches: GrepMatch[] = [];

    try {
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const contextBefore: string[] = [];
          const contextAfter: string[] = [];

          // Extract context lines before
          for (let j = Math.max(0, i - contextLines); j < i; j++) {
            contextBefore.push(lines[j]);
          }

          // Extract context lines after
          for (let j = i + 1; j <= Math.min(lines.length - 1, i + contextLines); j++) {
            contextAfter.push(lines[j]);
          }

          matches.push({
            file: filePath,
            lineNumber: i + 1, // 1-based line numbers
            line: lines[i],
            contextBefore,
            contextAfter,
          });
        }
      }
    } catch {
      // If we can't read the file, skip it (might be binary, permissions, etc.)
    }

    return matches;
  }

  /**
   * Check if a filename matches a pattern (simple glob support).
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    // Convert simple glob pattern to regex
    // Only supports *.ext for now
    if (pattern.startsWith('*.')) {
      const extension = pattern.slice(1); // Remove the *
      return filename.endsWith(extension);
    }

    // Exact match fallback
    return filename === pattern;
  }

  /**
   * Format matches into human-readable output.
   */
  private formatOutput(matches: GrepMatch[], basePath: string, wasTruncated: boolean): string {
    if (matches.length === 0) {
      return 'No matches found.';
    }

    const lines: string[] = [];

    for (const match of matches) {
      // Make path relative to base for readability
      let displayPath = match.file;
      if (match.file.startsWith(basePath)) {
        displayPath = match.file.slice(basePath.length + 1);
      }

      lines.push(`${displayPath}:${match.lineNumber}`);

      // Add context before
      for (const contextLine of match.contextBefore) {
        lines.push(`  | ${contextLine}`);
      }

      // Add the match line with a marker
      lines.push(`  > ${match.line}`);

      // Add context after
      for (const contextLine of match.contextAfter) {
        lines.push(`  | ${contextLine}`);
      }

      lines.push(''); // Empty line between matches
    }

    if (wasTruncated) {
      lines.push(`... (showing first ${matches.length} matches, more results available)`);
    } else {
      lines.push(`Found ${matches.length} match(es).`);
    }

    return lines.join('\n');
  }
}
