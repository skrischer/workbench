// @vitest-environment jsdom
// src/dashboard/ui/src/__tests__/hooks.test.ts — Tests for WebSocket and API Hooks

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useApi } from '../hooks/useApi.js';
import { apiClient, ApiError } from '../lib/api-client.js';

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  readyState = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  
  sentMessages: string[] = [];

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.(new CloseEvent('close'));
  }

  // Test helper: simulate receiving a message
  simulateMessage(data: unknown) {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data),
    });
    this.onmessage?.(event);
  }
}

// Replace global WebSocket
let originalWebSocket: typeof WebSocket;
let mockWsInstance: MockWebSocket | null = null;

beforeEach(() => {
  originalWebSocket = global.WebSocket;
  global.WebSocket = vi.fn((url: string) => {
    mockWsInstance = new MockWebSocket(url);
    return mockWsInstance as unknown as WebSocket;
  }) as unknown as typeof WebSocket;
  (global.WebSocket as any).OPEN = 1;
});

afterEach(() => {
  global.WebSocket = originalWebSocket;
  mockWsInstance = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('useWebSocket', () => {
  it('should connect and set connected state', async () => {
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.connected).toBe(false);

    // Wait for connection
    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    expect(result.current.clientId).toBeNull(); // clientId comes from server message
  });

  it('should receive and dispatch events to subscribers', async () => {
    const { result } = renderHook(() => useWebSocket());

    // Wait for connection
    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    // Subscribe to run:* events
    const runCallback = vi.fn();
    const unsubscribe = result.current.subscribe('run:*', runCallback);

    // Simulate server sending connected message
    mockWsInstance?.simulateMessage({
      type: 'connected',
      clientId: 'test-client-123',
      subscribedEvents: ['*'],
    });

    await waitFor(() => {
      expect(result.current.clientId).toBe('test-client-123');
    });

    // Simulate server sending run:start event
    mockWsInstance?.simulateMessage({
      type: 'event',
      event: 'run:start',
      data: { runId: 'run-1', agentConfig: {}, prompt: 'Test prompt' },
      timestamp: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(runCallback).toHaveBeenCalledWith({
        runId: 'run-1',
        agentConfig: {},
        prompt: 'Test prompt',
      });
    });

    unsubscribe();
  });

  it('should reconnect with exponential backoff after disconnect', async () => {
    const { result } = renderHook(() => useWebSocket());

    // Wait for initial connection
    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    });

    const firstWs = mockWsInstance;

    // Simulate disconnect
    firstWs?.close();

    await waitFor(() => {
      expect(result.current.connected).toBe(false);
    });

    // Wait for reconnect (should happen after 1 second)
    await waitFor(() => {
      expect(result.current.connected).toBe(true);
    }, { timeout: 2000 });

    // Verify a new WebSocket was created
    expect(mockWsInstance).not.toBe(firstWs);
  });
});

describe('apiClient', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch and parse JSON successfully', async () => {
    const mockData = { id: 1, name: 'Test' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const result = await apiClient('/test');
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('should throw ApiError on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'Resource not found' }),
    });

    await expect(apiClient('/test')).rejects.toThrow(ApiError);
    await expect(apiClient('/test')).rejects.toThrow('Resource not found');
  });

  it('should throw ApiError on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(apiClient('/test')).rejects.toThrow(ApiError);
    await expect(apiClient('/test')).rejects.toThrow('Network error');
  });
});

describe('useApi', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch data and update state', async () => {
    const mockData = { id: 1, name: 'Test' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const { result } = renderHook(() => useApi('/test'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should handle API errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'Server error' }),
    });

    const { result } = renderHook(() => useApi('/test'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Server error');
  });

  it('should refetch data when refetch is called', async () => {
    let callCount = 0;
    const mockData1 = { id: 1, name: 'First' };
    const mockData2 = { id: 2, name: 'Second' };
    
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      const data = callCount === 1 ? mockData1 : mockData2;
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => data,
      });
    });

    const { result } = renderHook(() => useApi('/test'));

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.data).toEqual(mockData1);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Trigger refetch
    result.current.refetch();

    // Wait for refetch to complete and data to update
    await waitFor(() => {
      expect(result.current.data).toEqual(mockData2);
    });
    
    expect(result.current.loading).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
