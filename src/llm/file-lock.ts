import fs from 'node:fs/promises';

/**
 * FileLock — Manages exclusive file locks using .lock files
 * 
 * Implements retry logic with exponential backoff for concurrent access.
 */
export class FileLock {
  private lockPath: string;
  private maxRetries = 5;
  private baseDelayMs = 100;

  constructor(lockPath: string) {
    this.lockPath = lockPath;
  }

  /**
   * Acquire the lock by creating the .lock file exclusively
   * Retries with exponential backoff on EEXIST
   */
  async acquire(): Promise<void> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Try to create lock file exclusively (fails if exists)
        await fs.writeFile(this.lockPath, String(process.pid), { flag: 'wx' });
        return; // Success!
      } catch (error: unknown) {
        // Type guard for NodeJS.ErrnoException
        if (error && typeof error === 'object' && 'code' in error) {
          const err = error as NodeJS.ErrnoException;
          if (err.code === 'EEXIST') {
            // Lock file exists, wait and retry
            if (attempt < this.maxRetries - 1) {
              const delay = this.baseDelayMs * Math.pow(2, attempt);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }
        }
        // Non-EEXIST error or final retry failed
        throw new Error(`Failed to acquire lock after ${this.maxRetries} attempts: ${error}`);
      }
    }
    throw new Error(`Failed to acquire lock at ${this.lockPath}`);
  }

  /**
   * Release the lock by deleting the .lock file
   */
  async release(): Promise<void> {
    try {
      await fs.unlink(this.lockPath);
    } catch (error: unknown) {
      // Ignore ENOENT - lock file already gone
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Execute a callback with automatic lock/unlock
   * Lock is always released in finally block
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      await this.release();
    }
  }
}
