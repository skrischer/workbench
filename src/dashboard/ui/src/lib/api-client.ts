// src/dashboard/ui/src/lib/api-client.ts — API Fetch Wrapper

/**
 * Get base API URL from environment or default to /api
 */
function getBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || '/api';
}

/**
 * API Error with status code
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Fetch wrapper with JSON parsing and error handling
 * 
 * @param endpoint - API endpoint (e.g., '/runs' or 'runs')
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws {ApiError} on HTTP errors or network failures
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = endpoint.startsWith('/') 
    ? `${baseUrl}${endpoint}` 
    : `${baseUrl}/${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    // Parse JSON body (even for errors)
    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle HTTP errors
    if (!response.ok) {
      const message = typeof data === 'object' && data && 'message' in data
        ? String((data as { message: string }).message)
        : `HTTP ${response.status}: ${response.statusText}`;
      
      throw new ApiError(message, response.status, data);
    }

    return data as T;
  } catch (err) {
    // Re-throw ApiError as-is
    if (err instanceof ApiError) {
      throw err;
    }

    // Network/fetch errors
    throw new ApiError(
      err instanceof Error ? err.message : 'Network request failed',
      0
    );
  }
}
