// src/tools/utils/ignore.ts — Shared Ignore Utility for Codebase Navigation
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
/**
 * Default patterns to ignore when walking directories.
 * These are common build artifacts, dependencies, and VCS directories.
 */
export const defaultIgnores = [
    'node_modules',
    '.git',
    'dist',
    'coverage',
    '.next',
    'build',
];
/**
 * Check if a file or directory name should be ignored.
 * @param name - File or directory name (not full path)
 * @param ignoreList - List of patterns to ignore
 * @returns true if the name matches any ignore pattern
 */
export function shouldIgnore(name, ignoreList) {
    return ignoreList.some((pattern) => {
        // Simple exact match for now
        // Could be extended to support glob patterns in the future
        return name === pattern;
    });
}
/**
 * Recursively walk a directory tree, yielding entries that aren't ignored.
 * @param rootPath - Starting directory path
 * @param options - Walk options (depth, ignore patterns)
 * @yields WalkEntry for each non-ignored file and directory
 */
export async function* walkDirectory(rootPath, options = {}) {
    const { depth = Infinity, ignore = [], _currentDepth = 0, } = options;
    // Combine default ignores with user-provided ones
    const ignoreList = [...defaultIgnores, ...ignore];
    // Stop if we've exceeded max depth
    if (_currentDepth > depth) {
        return;
    }
    let entries;
    try {
        entries = await readdir(rootPath);
    }
    catch {
        // If we can't read the directory, skip it
        return;
    }
    for (const entry of entries) {
        // Skip ignored entries
        if (shouldIgnore(entry, ignoreList)) {
            continue;
        }
        const fullPath = join(rootPath, entry);
        let stats;
        try {
            stats = await stat(fullPath);
        }
        catch {
            // If we can't stat the entry, skip it
            continue;
        }
        const type = stats.isDirectory() ? 'directory' : 'file';
        yield {
            path: fullPath,
            name: entry,
            type,
            depth: _currentDepth,
        };
        // Recurse into directories
        if (type === 'directory') {
            yield* walkDirectory(fullPath, {
                depth,
                ignore,
                _currentDepth: _currentDepth + 1,
            });
        }
    }
}
