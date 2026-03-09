// src/cli/__tests__/auth-command.test.ts — Auth Command Tests (PKCE OAuth)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAuthCommand } from '../auth-command.js';
import type { Command } from 'commander';
import type { TokenFile } from '../../types/index.js';

// Create mock functions that will be reused
let mockQuestion = vi.fn();
let mockClose = vi.fn();
let mockLoad = vi.fn();
let mockSave = vi.fn();
let mockFetch = vi.fn();
let mockEnsureValidToken = vi.fn();

// Mock readline
vi.mock('node:readline/promises', () => ({
  createInterface: () => ({
    question: mockQuestion,
    close: mockClose,
  }),
}));

// Mock TokenStorage
vi.mock('../../llm/token-storage.js', () => ({
  TokenStorage: class MockTokenStorage {
    load = mockLoad;
    save = mockSave;
  },
}));

// Mock TokenRefresher
vi.mock('../../llm/token-refresh.js', () => ({
  TokenRefresher: class MockTokenRefresher {
    ensureValidToken = mockEnsureValidToken;
  },
}));

// Mock global fetch
global.fetch = mockFetch as never;

describe('Auth Command', () => {
  let command: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh command instance
    command = createAuthCommand();

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Spy on process.exit and prevent actual exit
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a command named "auth"', () => {
    expect(command.name()).toBe('auth');
  });

  it('should have a description', () => {
    expect(command.description()).toBeTruthy();
    expect(command.description().toLowerCase()).toContain('oauth');
  });

  describe('Interactive Auth (PKCE Flow)', () => {
    it('should show OAuth URL and exchange code for tokens', async () => {
      // Mock OAuth token response
      const mockTokenResponse = {
        access_token: 'sk-ant-oat01-newlyissuedaccesstoken123',
        refresh_token: 'sk-ant-ort01-newlyissuedrefreshtoken123',
        expires_in: 3600
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse
      });

      // Mock user input (code#state string)
      mockQuestion.mockResolvedValueOnce('authcode123abc#statexyz789def');

      // Parse command (triggers default action)
      await command.parseAsync([], { from: 'user' });

      // Verify OAuth URL was shown
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('OAuth PKCE Setup'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('https://claude.ai/oauth/authorize'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('code_challenge'));

      // Verify fetch was called to token endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth/token'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('authorization_code')
        })
      );

      // Verify tokens were saved
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          anthropic: expect.objectContaining({
            type: 'oauth',
            access: 'sk-ant-oat01-newlyissuedaccesstoken123',
            refresh: 'sk-ant-ort01-newlyissuedrefreshtoken123',
            expires: expect.any(Number),
          }),
        })
      );

      // Verify success message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅ OAuth tokens saved'));

      // Verify readline was closed
      expect(mockClose).toHaveBeenCalled();
    });

    it('should reject invalid code#state format', async () => {
      // Mock user input without # separator
      mockQuestion.mockResolvedValueOnce('invalidformatnohashtag');

      try {
        await command.parseAsync([], { from: 'user' });
      } catch (error) {
        expect(String(error)).toContain('process.exit');
      }

      // Verify error was shown
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid format'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('code#state'));
    });

    it('should handle token exchange failure', async () => {
      // Mock failed token exchange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid authorization code'
      });

      mockQuestion.mockResolvedValueOnce('badcode123#badstate456');

      try {
        await command.parseAsync([], { from: 'user' });
      } catch (error) {
        expect(String(error)).toContain('process.exit');
      }

      // Verify error was shown
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Auth setup failed'));
    });

    it('should handle network errors during token exchange', async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      mockQuestion.mockResolvedValueOnce('code123#state456');

      try {
        await command.parseAsync([], { from: 'user' });
      } catch (error) {
        expect(String(error)).toContain('process.exit');
      }

      // Verify error was shown
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Auth setup failed'));
    });
  });

  describe('Status Command', () => {
    it('should show status with valid tokens', async () => {
      // Mock valid tokens (expires in 30 days)
      const mockTokens: TokenFile = {
        anthropic: {
          type: 'oauth',
          access: 'sk-ant-oat01-validaccesstoken1234567890',
          refresh: 'sk-ant-ort01-validrefreshtoken1234567890',
          expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
        },
      };
      mockLoad.mockResolvedValue(mockTokens);

      // Parse status subcommand
      await command.parseAsync(['status'], { from: 'user' });

      // Verify status was shown
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Tokens configured'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('sk-ant-oat01-***'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('sk-ant-ort01-***'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('tokens.json'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Expires in: \d+ days/));
    });

    it('should show hours/minutes for tokens expiring soon', async () => {
      // Mock tokens expiring in 2 hours
      const mockTokens: TokenFile = {
        anthropic: {
          type: 'oauth',
          access: 'sk-ant-oat01-expiringsoon1234567890',
          refresh: 'sk-ant-ort01-expiringsoon1234567890',
          expires: Date.now() + 2 * 60 * 60 * 1000,
        },
      };
      mockLoad.mockResolvedValue(mockTokens);

      await command.parseAsync(['status'], { from: 'user' });

      // Verify hours/minutes format
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Expires in: \d+ hours, \d+ minutes/));
    });

    it('should warn about expired tokens', async () => {
      // Mock expired tokens (expired 5 days ago)
      const mockTokens: TokenFile = {
        anthropic: {
          type: 'oauth',
          access: 'sk-ant-oat01-expiredtoken1234567890',
          refresh: 'sk-ant-ort01-expiredrefresh1234567890',
          expires: Date.now() - 5 * 24 * 60 * 60 * 1000,
        },
      };
      mockLoad.mockResolvedValue(mockTokens);

      await command.parseAsync(['status'], { from: 'user' });

      // Verify expiry warning
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Expired'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Expired \d+ hours ago/));
    });

    it('should handle missing token file', async () => {
      // Mock token file not found
      mockLoad.mockRejectedValue(new Error('Token file not found'));

      try {
        await command.parseAsync(['status'], { from: 'user' });
      } catch (error) {
        expect(String(error)).toContain('process.exit');
      }

      // Verify error message
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ No tokens configured'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Run: workbench auth'));
    });
  });

  describe('Refresh Command', () => {
    it('should use TokenRefresher to refresh tokens', async () => {
      // Mock successful refresh
      mockEnsureValidToken.mockResolvedValue('sk-ant-oat01-refreshedtoken123');

      await command.parseAsync(['refresh'], { from: 'user' });

      // Verify refresh was called
      expect(mockEnsureValidToken).toHaveBeenCalled();

      // Verify refresh message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Refreshing tokens'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Tokens refreshed successfully'));
    });

    it('should handle missing token file during refresh', async () => {
      // Mock token file not found
      mockEnsureValidToken.mockRejectedValue(new Error('Token file not found'));

      try {
        await command.parseAsync(['refresh'], { from: 'user' });
      } catch (error) {
        expect(String(error)).toContain('process.exit');
      }

      // Verify error message
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ No tokens found'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Run: workbench auth'));
    });

    it('should handle refresh API errors', async () => {
      // Mock refresh failure
      mockEnsureValidToken.mockRejectedValue(new Error('Refresh token expired or invalid'));

      try {
        await command.parseAsync(['refresh'], { from: 'user' });
      } catch (error) {
        expect(String(error)).toContain('process.exit');
      }

      // Verify error message
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ Refresh failed'));
    });
  });

  describe('File Operations', () => {
    it('should save tokens with correct expiry timestamp (with buffer)', async () => {
      const beforeTimestamp = Date.now();

      // Mock OAuth token response (1 hour expiry)
      const mockTokenResponse = {
        access_token: 'sk-ant-oat01-newtoken123',
        refresh_token: 'sk-ant-ort01-newtoken123',
        expires_in: 3600 // 1 hour
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse
      });

      mockQuestion.mockResolvedValueOnce('code123#state456');

      await command.parseAsync([], { from: 'user' });

      // Get the saved token data
      const savedTokens = mockSave.mock.calls[0][0] as TokenFile;
      const expiresTimestamp = savedTokens.anthropic.expires;

      // Verify expiry is approximately 1 hour - 5 min buffer from now
      const expectedExpiry = beforeTimestamp + (3600 * 1000) - (5 * 60 * 1000);
      const tolerance = 5000; // 5 seconds tolerance
      expect(expiresTimestamp).toBeGreaterThanOrEqual(expectedExpiry - tolerance);
      expect(expiresTimestamp).toBeLessThanOrEqual(expectedExpiry + tolerance);
    });
  });
});
