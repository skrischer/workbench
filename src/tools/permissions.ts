// src/tools/permissions.ts - Path-based Permission Guard

import { minimatch } from 'minimatch';
import { resolve } from 'node:path';

/**
 * Error thrown when a path permission check fails
 */
export class PermissionError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly allowedPaths: string[]
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * PermissionGuard enforces path-based access control for agent tools.
 * Supports glob patterns for flexible allowlists.
 */
export class PermissionGuard {
  private readonly patterns: string[];

  /**
   * Create a new PermissionGuard with glob patterns
   * @param allowedPaths Array of glob patterns
   */
  constructor(allowedPaths: string[]) {
    this.patterns = allowedPaths.map((p) => resolve(p));
  }

  /**
   * Check if a path is allowed by the allowlist
   * @param path Path to check (will be resolved to absolute path)
   * @returns true if allowed, false otherwise
   */
  isPathAllowed(path: string): boolean {
    if (this.patterns.length === 0) {
      return true;
    }

    const absolutePath = resolve(path);

    for (const pattern of this.patterns) {
      if (minimatch(absolutePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a path is allowed, throwing PermissionError if not
   * @param path Path to check
   * @throws PermissionError if path is not in allowlist
   */
  checkPath(path: string): void {
    if (!this.isPathAllowed(path)) {
      const absolutePath = resolve(path);
      throw new PermissionError(
        `Path "${absolutePath}" is not in the allowed paths. Allowed patterns: ${this.patterns.join(', ')}`,
        absolutePath,
        this.patterns
      );
    }
  }

  /**
   * Get the configured allowed path patterns
   */
  getAllowedPatterns(): string[] {
    return [...this.patterns];
  }
}
