// src/dashboard/ui/src/hooks/useApi.ts — React Hook for API Requests

import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../lib/api-client.js';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  sort?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface UseApiPaginatedResult<T> {
  data: T[];
  total: number;
  loading: boolean;
  error: string | null;
  offset: number;
  limit: number;
  refetch: () => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSort: (sort: 'asc' | 'desc') => void;
}

/**
 * React hook for API requests with loading/error states
 * 
 * @param endpoint - API endpoint (e.g., '/runs')
 * @param options - Fetch options (optional)
 * @returns { data, loading, error, refetch }
 * 
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useApi<Run[]>('/runs');
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error}</div>;
 * return <div>{data?.length} runs</div>;
 * ```
 */
export function useApi<T = unknown>(
  endpoint: string,
  options?: RequestInit
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const result = await apiClient<T>(endpoint, options);
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Unknown error';
          setError(message);
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [endpoint, refreshKey]); // options intentionally excluded to avoid re-fetch on every render

  return { data, loading, error, refetch };
}

/**
 * React hook for paginated API requests
 * 
 * @param endpoint - API endpoint (e.g., '/runs')
 * @param initialOptions - Initial pagination options
 * @returns Paginated result with controls
 * 
 * @example
 * ```tsx
 * const { data, total, loading, error, setPage } = useApiPaginated<Run>('/runs', { limit: 10 });
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error}</div>;
 * return (
 *   <div>
 *     {data.map(run => <div key={run.id}>{run.id}</div>)}
 *     <Pagination total={total} onPageChange={setPage} />
 *   </div>
 * );
 * ```
 */
export function useApiPaginated<T = unknown>(
  endpoint: string,
  initialOptions: PaginationOptions = {}
): UseApiPaginatedResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState<number>(initialOptions.offset ?? 0);
  const [limit, setLimit] = useState<number>(initialOptions.limit ?? 50);
  const [sort, setSort] = useState<'asc' | 'desc'>(initialOptions.sort ?? 'desc');
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const setPage = useCallback((page: number) => {
    setOffset(page * limit);
  }, [limit]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Build query string
        const params = new URLSearchParams();
        params.set('limit', limit.toString());
        params.set('offset', offset.toString());
        params.set('sort', sort);
        
        const url = `${endpoint}?${params.toString()}`;
        const result = await apiClient<PaginatedResult<T>>(url);
        
        if (!cancelled) {
          setData(result.data);
          setTotal(result.total);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Unknown error';
          setError(message);
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [endpoint, offset, limit, sort, refreshKey]);

  return { 
    data, 
    total, 
    loading, 
    error, 
    offset, 
    limit, 
    refetch, 
    setPage, 
    setLimit, 
    setSort 
  };
}
