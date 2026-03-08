// src/tools/list-files.ts — List Files Tool
import { stat } from 'node:fs/promises';
import { basename, relative } from 'node:path';
import { BaseTool } from './base.js';
import { walkDirectory } from './utils/ignore.js';
/**
 * Simple glob pattern matcher.
 * Supports * wildcard and basic string matching.
 * @param name - File or directory name to test
 * @param pattern - Glob pattern (e.g., "*.ts", "test*", "*config*")
 * @returns true if name matches the pattern
 */
function matchesPattern(name, pattern) {
    // Convert glob pattern to regex
    const regexPattern = pattern
        .replace(/\./g, '\\.') // Escape dots
        .replace(/\*/g, '.*'); // Convert * to .*
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(name);
}
/**
 * Tool for listing files and directories in a tree structure.
 * Supports depth limiting, glob filtering, and ignore patterns.
 */
export class ListFilesTool extends BaseTool {
    name = 'list_files';
    description = 'List files and directories in a tree structure with configurable depth, filtering, and ignore patterns.';
    inputSchema = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Root directory path to list',
            },
            depth: {
                type: 'number',
                description: 'Maximum depth to traverse (default: 3)',
            },
            pattern: {
                type: 'string',
                description: 'Glob pattern to filter files (e.g., "*.ts", "*test*")',
            },
            ignore: {
                type: 'array',
                items: { type: 'string' },
                description: 'Additional patterns to ignore beyond defaults',
            },
        },
        required: ['path'],
    };
    async execute(input) {
        const path = input.path;
        const depth = input.depth ?? 3;
        const pattern = input.pattern;
        const ignore = input.ignore;
        try {
            // Check if path exists and is a directory
            const stats = await stat(path);
            if (!stats.isDirectory()) {
                return {
                    success: false,
                    output: '',
                    error: `Path '${path}' is not a directory`,
                };
            }
            // Collect entries
            const entries = [];
            for await (const entry of walkDirectory(path, { depth, ignore })) {
                // Apply pattern filter if specified
                if (pattern && !matchesPattern(entry.name, pattern)) {
                    // For directories, still include them so we can traverse
                    // but only if they're not at max depth (we need to see their contents)
                    if (entry.type === 'file') {
                        continue;
                    }
                }
                entries.push(entry);
            }
            // Build tree structure
            const tree = [];
            const rootName = basename(path);
            tree.push(`${rootName}/`);
            // Sort entries: directories first, then files, both alphabetically
            entries.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.path.localeCompare(b.path);
            });
            // Group by path hierarchy
            for (const entry of entries) {
                const relPath = relative(path, entry.path);
                const indent = '  '.repeat(entry.depth + 1);
                const marker = entry.type === 'directory' ? '/' : '';
                tree.push(`${indent}${entry.name}${marker}`);
            }
            const fileCount = entries.filter(e => e.type === 'file').length;
            const dirCount = entries.filter(e => e.type === 'directory').length;
            tree.push('');
            tree.push(`${fileCount} file(s), ${dirCount} director${dirCount === 1 ? 'y' : 'ies'}`);
            return {
                success: true,
                output: tree.join('\n'),
                metadata: {
                    path,
                    depth,
                    pattern,
                    ignore,
                    fileCount,
                    directoryCount: dirCount,
                    totalEntries: entries.length,
                },
            };
        }
        catch (err) {
            const error = err;
            return {
                success: false,
                output: '',
                error: `Failed to list files in '${path}': ${error.message}`,
            };
        }
    }
}
