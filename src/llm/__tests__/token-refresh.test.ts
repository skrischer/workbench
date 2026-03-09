// src/llm/__tests__/token-refresh.test.ts — Tests for TokenRefresher

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TokenRefresher } from '../token-refresh.js';
import { TokenStorage } from '../token-storage.js';
import type { TokenFile } from '../../types/index.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('TokenRefresher', () => {
  let mockTokenStorage: TokenStorage;
  let refresher: TokenRefresher;
  let validTokenFile: TokenFile;
  let expiredTokenFile: TokenFile;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock TokenStorage
    mockTokenStorage = {
      load: vi.fn(),
      save: vi.fn(),
      isExpired: vi.fn(),
      getAccessToken: vi.fn()
    } as unknown as TokenStorage;

    refresher = new TokenRefresher(mockTokenStorage);

    // Setup test data
    validTokenFile = {
      anthropic: {
        type: 'oauth',
        access: 'valid-access-token',
        refresh: 'valid-refresh-token',
        expires: Date.now() + 3600000 // 1 hour from now
      }
    };

    expiredTokenFile = {
      anthropic: {
        type: 'oauth',
        access: 'expired-access-token',
        refresh: 'expired-refresh-token',
        expires: Date.now() - 1000 // 1 second ago
      }
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return existing token when still valid (no refresh)', async () => {
    // Mock TokenStorage to return valid token
    vi.mocked(mockTokenStorage.load).mockResolvedValue(validTokenFile);
    vi.mocked(mockTokenStorage.isExpired).mockReturnValue(false);

    const token = await refresher.ensureValidToken();

    expect(token).toBe('valid-access-token');
    expect(mockTokenStorage.load).toHaveBeenCalledTimes(1);
    expect(mockTokenStorage.isExpired).toHaveBeenCalledWith(validTokenFile.anthropic);
    expect(mockTokenStorage.save).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should refresh token when expired', async () => {
    // Mock TokenStorage to return expired token initially
    vi.mocked(mockTokenStorage.load)
      .mockResolvedValueOnce(expiredTokenFile) // First load
      .mockResolvedValueOnce(expiredTokenFile); // Re-check after lock
    
    vi.mocked(mockTokenStorage.isExpired).mockReturnValue(true);

    // Mock fetch to return successful refresh response
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      })
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    const token = await refresher.ensureValidToken();

    expect(token).toBe('new-access-token');
    expect(mockTokenStorage.load).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockTokenStorage.save).toHaveBeenCalledTimes(1);

    // Verify fetch was called with correct parameters
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[0]).toBe('https://console.anthropic.com/v1/oauth/token');
    expect(fetchCall[1]?.method).toBe('POST');
    expect(fetchCall[1]?.headers).toEqual({ 'Content-Type': 'application/json' });
    
    const requestBody = JSON.parse(fetchCall[1]?.body as string);
    expect(requestBody.grant_type).toBe('refresh_token');
    expect(requestBody.client_id).toBe('9d1c250a-e61b-44d9-88ed-5944d1962f5e');
    expect(requestBody.refresh_token).toBe('expired-refresh-token');
  });

  it('should implement double-checked locking (re-check after lock)', async () => {
    // First call: token is expired
    // After lock acquired: token is now valid (another process refreshed it)
    vi.mocked(mockTokenStorage.load)
      .mockResolvedValueOnce(expiredTokenFile) // First check
      .mockResolvedValueOnce(validTokenFile);  // Re-check after lock

    vi.mocked(mockTokenStorage.isExpired)
      .mockReturnValueOnce(true)  // First check: expired
      .mockReturnValueOnce(false); // Re-check: now valid

    const token = await refresher.ensureValidToken();

    expect(token).toBe('valid-access-token');
    expect(mockTokenStorage.load).toHaveBeenCalledTimes(2);
    expect(mockTokenStorage.isExpired).toHaveBeenCalledTimes(2);
    expect(mockFetch).not.toHaveBeenCalled(); // No refresh needed
    expect(mockTokenStorage.save).not.toHaveBeenCalled();
  });

  it('should throw error on 401 refresh failure', async () => {
    vi.mocked(mockTokenStorage.load)
      .mockResolvedValueOnce(expiredTokenFile)
      .mockResolvedValueOnce(expiredTokenFile);
    
    vi.mocked(mockTokenStorage.isExpired).mockReturnValue(true);

    // Mock 401 response
    const mockResponse = {
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await expect(refresher.ensureValidToken()).rejects.toThrow(
      'Refresh token expired or invalid. Please re-authorize via OAuth flow in your browser.'
    );
  });

  it('should throw error on 400 refresh failure', async () => {
    vi.mocked(mockTokenStorage.load)
      .mockResolvedValueOnce(expiredTokenFile)
      .mockResolvedValueOnce(expiredTokenFile);
    
    vi.mocked(mockTokenStorage.isExpired).mockReturnValue(true);

    // Mock 400 response
    const mockResponse = {
      ok: false,
      status: 400,
      text: async () => 'Bad Request'
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await expect(refresher.ensureValidToken()).rejects.toThrow(
      'Refresh token expired or invalid. Please re-authorize via OAuth flow in your browser.'
    );
  });

  it('should throw error on network failure during refresh', async () => {
    vi.mocked(mockTokenStorage.load)
      .mockResolvedValueOnce(expiredTokenFile)
      .mockResolvedValueOnce(expiredTokenFile);
    
    vi.mocked(mockTokenStorage.isExpired).mockReturnValue(true);

    // Mock network error
    mockFetch.mockRejectedValue(new Error('Network connection failed'));

    await expect(refresher.ensureValidToken()).rejects.toThrow(
      'Network error during token refresh: Error: Network connection failed'
    );
  });

  it('should throw error on 500 server error during refresh', async () => {
    vi.mocked(mockTokenStorage.load)
      .mockResolvedValueOnce(expiredTokenFile)
      .mockResolvedValueOnce(expiredTokenFile);
    
    vi.mocked(mockTokenStorage.isExpired).mockReturnValue(true);

    // Mock 500 response
    const mockResponse = {
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error'
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    await expect(refresher.ensureValidToken()).rejects.toThrow(
      'Token refresh failed with status 500: Internal Server Error'
    );
  });

  it('should handle invalid JSON in refresh response', async () => {
    vi.mocked(mockTokenStorage.load)
      .mockResolvedValueOnce(expiredTokenFile)
      .mockResolvedValueOnce(expiredTokenFile);
    
    vi.mocked(mockTokenStorage.isExpired).mockReturnValue(true);

    // Mock response with invalid JSON
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token in JSON');
      }
    };
    mockFetch.mockResolvedValue(mockResponse as unknown as Response);

    await expect(refresher.ensureValidToken()).rejects.toThrow(
      'Failed to parse token refresh response'
    );
  });

  it('should correctly calculate token expiry with buffer', async () => {
    vi.mocked(mockTokenStorage.load)
      .mockResolvedValueOnce(expiredTokenFile)
      .mockResolvedValueOnce(expiredTokenFile);
    
    vi.mocked(mockTokenStorage.isExpired).mockReturnValue(true);

    const expiresIn = 3600; // 1 hour
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_in: expiresIn
      })
    };
    mockFetch.mockResolvedValue(mockResponse as Response);

    const now = Date.now();
    await refresher.ensureValidToken();

    // Verify save was called with correct expiry (with 5 minute buffer)
    const saveCall = vi.mocked(mockTokenStorage.save).mock.calls[0][0];
    const expectedExpiry = now + (expiresIn * 1000) - (5 * 60 * 1000);
    
    // Allow 100ms tolerance for test execution time
    expect(saveCall.anthropic.expires).toBeGreaterThanOrEqual(expectedExpiry - 100);
    expect(saveCall.anthropic.expires).toBeLessThanOrEqual(expectedExpiry + 100);
  });
});
