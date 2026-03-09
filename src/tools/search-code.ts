// src/tools/search-code.ts — Search Code Tool

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BaseTool } from './base.js';
import type { ToolResult, ToolContext } from '../types/index.js';
import { walkDirectory } from './utils/ignore.js';

/**
 * Type of code construct to search for.
 */
type SearchType = 'function' | 'class' | 'interface' | 'type' | 'export' | 'import' | 'all';

/**
 * Language-specific file extensions.
 */
const languageExtensions: Record<string, string[]> = {
  typescript: ['.ts', '.tsx'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  python: ['.py'],
  rust: ['.rs'],
  go: ['.go'],
  java: ['.java'],
  cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
  csharp: ['.cs'],
};

interface SearchMatch {
  file: string;
  line: number;
  match: string;
  context: string[];
}

/**
 * Tool for searching code constructs (functions, classes, interfaces, etc.) in a codebase.
 * Uses regex heuristics to find declarations without full AST parsing.
 */
export class SearchCodeTool extends BaseTool {
  readonly name = 'search_code';
  readonly description =
    'Search for code constructs (functions, classes, interfaces, types) by name using regex heuristics. Returns matches with file path, line number, and context.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Name or pattern to search for',
      },
      path: {
        type: 'string',
        description: 'Directory path to search in (default: ".")',
        default: '.',
      },
      type: {
        type: 'string',
        enum: ['function', 'class', 'interface', 'type', 'export', 'import', 'all'],
        description: 'Type of construct to search for (default: "all")',
        default: 'all',
      },
      language: {
        type: 'string',
        description: 'Filter by language (typescript, javascript, python, rust, go, java, cpp, csharp)',
      },
    },
    required: ['query'],
  };

  async execute(input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    const query = input.query as string;
    const searchPath = resolve(input.path as string || '.');
    const searchType = (input.type as SearchType) || 'all';
    const language = input.language as string | undefined;

    try {
      const matches: SearchMatch[] = [];
      const allowedExtensions = language
        ? languageExtensions[language.toLowerCase()] || []
        : [];

      // Walk the directory tree
      for await (const entry of walkDirectory(searchPath, { depth: 10 })) {
        if (entry.type !== 'file') continue;

        // Filter by language if specified
        if (allowedExtensions.length > 0) {
          const hasAllowedExt = allowedExtensions.some((ext) =>
            entry.name.endsWith(ext)
          );
          if (!hasAllowedExt) continue;
        }

        // Only search in common code file extensions
        if (!this.isCodeFile(entry.name)) continue;

        try {
          const content = await readFile(entry.path, 'utf-8');
          const fileMatches = this.searchInFile(content, query, searchType);

          for (const match of fileMatches) {
            matches.push({
              file: entry.path,
              line: match.line,
              match: match.match,
              context: match.context,
            });
          }
        } catch {
          // Skip files we can't read
          continue;
        }
      }

      if (matches.length === 0) {
        return {
          success: true,
          output: `No matches found for "${query}" (type: ${searchType})`,
          metadata: {
            query,
            type: searchType,
            language,
            matchCount: 0,
          },
        };
      }

      // Format output
      const output = this.formatMatches(matches, query);

      return {
        success: true,
        output,
        metadata: {
          query,
          type: searchType,
          language,
          matchCount: matches.length,
        },
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: '',
        error: `Search failed: ${error.message}`,
      };
    }
  }

  /**
   * Check if a filename represents a code file.
   */
  private isCodeFile(filename: string): boolean {
    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.rs', '.go', '.java', '.cpp', '.cc',
      '.cxx', '.hpp', '.h', '.cs', '.rb', '.php',
      '.swift', '.kt', '.scala', '.clj',
    ];
    return codeExtensions.some((ext) => filename.endsWith(ext));
  }

  /**
   * Search for constructs in file content.
   */
  private searchInFile(
    content: string,
    query: string,
    type: SearchType
  ): Array<{ line: number; match: string; context: string[] }> {
    const lines = content.split('\n');
    const matches: Array<{ line: number; match: string; context: string[] }> = [];
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Build regex patterns for different construct types
    const patterns: RegExp[] = [];

    if (type === 'all' || type === 'function') {
      // Match function declarations
      patterns.push(
        new RegExp(`\\bfunction\\s+${escapedQuery}\\b`, 'i'),
        new RegExp(`\\b${escapedQuery}\\s*[:=]\\s*function\\b`, 'i'),
        new RegExp(`\\b${escapedQuery}\\s*[:=]\\s*\\([^)]*\\)\\s*=>`, 'i'),
        new RegExp(`\\bconst\\s+${escapedQuery}\\s*=\\s*\\([^)]*\\)\\s*=>`, 'i'),
        new RegExp(`\\bdef\\s+${escapedQuery}\\b`, 'i'), // Python
        new RegExp(`\\bfn\\s+${escapedQuery}\\b`, 'i'),  // Rust
        new RegExp(`\\bfunc\\s+${escapedQuery}\\b`, 'i'), // Go
      );
    }

    if (type === 'all' || type === 'class') {
      // Match class declarations
      patterns.push(
        new RegExp(`\\bclass\\s+${escapedQuery}\\b`, 'i'),
      );
    }

    if (type === 'all' || type === 'interface') {
      // Match interface declarations
      patterns.push(
        new RegExp(`\\binterface\\s+${escapedQuery}\\b`, 'i'),
      );
    }

    if (type === 'all' || type === 'type') {
      // Match type declarations
      patterns.push(
        new RegExp(`\\btype\\s+${escapedQuery}\\b`, 'i'),
      );
    }

    if (type === 'all' || type === 'export') {
      // Match export statements
      patterns.push(
        new RegExp(`\\bexport\\s+.*\\b${escapedQuery}\\b`, 'i'),
      );
    }

    if (type === 'all' || type === 'import') {
      // Match import statements
      patterns.push(
        new RegExp(`\\bimport\\s+.*\\b${escapedQuery}\\b`, 'i'),
        new RegExp(`\\bfrom\\s+['"].*${escapedQuery}.*['"]`, 'i'),
      );
    }

    // Search each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of patterns) {
        if (pattern.test(line)) {
          // Get 3 lines of context after the match
          const context = lines.slice(i + 1, i + 4);

          matches.push({
            line: i + 1, // 1-based line number
            match: line.trim(),
            context,
          });
          break; // Only count once per line
        }
      }
    }

    return matches;
  }

  /**
   * Format matches for output.
   */
  private formatMatches(matches: SearchMatch[], query: string): string {
    const lines: string[] = [];
    lines.push(`Found ${matches.length} match(es) for "${query}":\n`);

    for (const match of matches) {
      lines.push(`${match.file}:${match.line}`);
      lines.push(`  ${match.match}`);

      if (match.context.length > 0) {
        for (const contextLine of match.context) {
          if (contextLine.trim()) {
            lines.push(`  ${contextLine}`);
          }
        }
      }

      lines.push(''); // Empty line between matches
    }

    return lines.join('\n');
  }
}
