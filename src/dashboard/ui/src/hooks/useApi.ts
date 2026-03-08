// src/dashboard/ui/src/hooks/useApi.ts — React Hook for API Requests

import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '../lib/api-client.js';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
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
