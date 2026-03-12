// src/tui/__tests__/auth-command.test.ts — Auth Command Tests (migrated from src/cli/)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAuthCommand } from '../commands/auth-command.js';
import type { Command } from 'commander';
import type { TokenFile } from '../../types/index.js';

let mockQuestion = vi.fn();
let mockClose = vi.fn();
let mockLoad = vi.fn();
let mockSave = vi.fn();
let mockFetch = vi.fn();
let mockEnsureValidToken = vi.fn();

vi.mock('node:readline/promises', () => ({
  createInterface: () => ({
    question: mockQuestion,
    close: mockClose,
  }),
}));

vi.mock('../../llm/token-storage.js', () => ({
  TokenStorage: class MockTokenStorage {
    load = mockLoad;
    save = mockSave;
  },
}));

vi.mock('../../llm/token-refresh.js', () => ({
  TokenRefresher: class MockTokenRefresher {
    ensureValidToken = mockEnsureValidToken;
  },
}));

global.fetch = mockFetch as never;

describe('Auth Command', () => {
  let command: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    command = createAuthCommand();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
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
      const mockTokenResponse = {
        access_token: 'sk-ant-oat01-newlyissuedaccesstoken123',
        refresh_token: 'sk-ant-ort01-newlyissuedrefreshtoken123',
        expires_in: 3600
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse
      });

      mockQuestion.mockResolvedValueOnce('authcode123abc#statexyz789def');

      await command.parseAsync([], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('OAuth PKCE Setup'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('https://claude.ai/oauth/authorize'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('code_challenge'));

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('oauth/token'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('authorization_code')
        })
      );

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

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('OAuth tokens saved'));
      expect(mockClose).toHaveBeenCalled();
    });

    it('should handle token exchange failure', async () => {
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Auth setup failed'));
    });
  });

  describe('Status Command', () => {
    it('should show status with valid tokens', async () => {
      const mockTokens: TokenFile = {
        anthropic: {
          type: 'oauth',
          access: 'sk-ant-oat01-validaccesstoken1234567890',
          refresh: 'sk-ant-ort01-validrefreshtoken1234567890',
          expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
        },
      };
      mockLoad.mockResolvedValue(mockTokens);

      await command.parseAsync(['status'], { from: 'user' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Tokens configured'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('sk-ant-oat01-***'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('tokens.json'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Expires in: \d+ days/));
    });

    it('should handle missing token file', async () => {
      mockLoad.mockRejectedValue(new Error('Token file not found'));

      try {
        await command.parseAsync(['status'], { from: 'user' });
      } catch (error) {
        expect(String(error)).toContain('process.exit');
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No tokens configured'));
    });
  });

  describe('Refresh Command', () => {
    it('should use TokenRefresher to refresh tokens', async () => {
      mockEnsureValidToken.mockResolvedValue('sk-ant-oat01-refreshedtoken123');

      await command.parseAsync(['refresh'], { from: 'user' });

      expect(mockEnsureValidToken).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Refreshing tokens'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Tokens refreshed successfully'));
    });

    it('should handle missing token file during refresh', async () => {
      mockEnsureValidToken.mockRejectedValue(new Error('Token file not found'));

      try {
        await command.parseAsync(['refresh'], { from: 'user' });
      } catch (error) {
        expect(String(error)).toContain('process.exit');
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No tokens found'));
    });
  });
});
