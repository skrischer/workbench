// src/types/storage.ts — Generic Storage Pagination Interfaces

/**
 * Options for paginated list queries across all storage modules
 */
export interface StorageListOptions {
  /** Starting offset (default: 0) */
  offset?: number;
  /** Maximum items to return (default: 50, max: 100) */
  limit?: number;
  /** Sort order by createdAt (default: 'desc' = newest first) */
  sort?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper with metadata
 */
export interface StorageListResult<T> {
  /** Array of items for the current page */
  data: T[];
  /** Total count of items (across all pages) */
  total: number;
  /** Current offset */
  offset: number;
  /** Current limit */
  limit: number;
}

/**
 * Apply default values and caps to list options
 */
export function normalizeListOptions(options?: StorageListOptions): Required<StorageListOptions> {
  const offset = Math.max(0, options?.offset ?? 0);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
  const sort = options?.sort ?? 'desc';
  
  return { offset, limit, sort };
}
