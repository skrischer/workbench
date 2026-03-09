// src/cli/__tests__/auth-command.test.ts — Auth Command Tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAuthCommand } from '../auth-command.js';
import type { Command } from 'commander';
import type { TokenFile } from '../../types/index.js';

// Create mock functions that will be reused
let mockQuestion = vi.fn();
let mockClose = vi.fn();
let mockLoad = vi.fn();
let mockSave = vi.fn();

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

  describe('Interactive Auth (Happy Path)', () => {
    it('should prompt for tokens and save valid tokens', async () => {
      // Mock user input
      mockQuestion
        .mockResolvedValueOnce('sk-ant-oat01-validaccesstoken1234567890')
        .mockResolvedValueOnce('sk-ant-ort01-validrefreshtoken1234567890');

      // Parse command (triggers default action)
      await command.parseAsync([], { from: 'user' });

      // Verify prompts were shown
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('OAuth Token Setup'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('https://console.anthropic.com'));

      // Verify tokens were saved
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          anthropic: expect.objectContaining({
            type: 'oauth',
            access: 'sk-ant-oat01-validaccesstoken1234567890',
            refresh: 'sk-ant-ort01-validrefreshtoken1234567890',
            expires: expect.any(Number),
          }),
        })
      );

      // Verify success message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Tokens validated and saved'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('90 days'));

      // Verify readline was closed
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('Token Validation', () => {
    it('should reject invalid Access Token prefix', async () => {
      // First attempt: invalid prefix
      // Second attempt: valid tokens
      mockQuestion
        .mockResolvedValueOnce('sk-ant-invalid-token')
        .mockResolvedValueOnce('sk-ant-oat01-validaccesstoken1234567890')
        .mockResolvedValueOnce('sk-ant-ort01-validrefreshtoken1234567890');

      await command.parseAsync([], { from: 'user' });

      // Verify error was shown for first attempt
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('sk-ant-oat01-'));

      // Verify tokens were eventually saved
      expect(mockSave).toHaveBeenCalled();
    });

    it('should reject invalid Refresh Token prefix', async () => {
      // Valid access token, then invalid refresh, then valid refresh
      mockQuestion
        .mockResolvedValueOnce('sk-ant-oat01-validaccesstoken1234567890')
        .mockResolvedValueOnce('sk-ant-invalid-refresh')
        .mockResolvedValueOnce('sk-ant-ort01-validrefreshtoken1234567890');

      await command.parseAsync([], { from: 'user' });

      // Verify error was shown for invalid refresh token
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('sk-ant-ort01-'));

      // Verify tokens were eventually saved
      expect(mockSave).toHaveBeenCalled();
    });

    it('should reject tokens that are too short', async () => {
      // Too short, then valid
      mockQuestion
        .mockResolvedValueOnce('sk-ant-oat01-short')
        .mockResolvedValueOnce('sk-ant-oat01-validaccesstoken1234567890')
        .mockResolvedValueOnce('sk-ant-ort01-validrefreshtoken1234567890');

      await command.parseAsync([], { from: 'user' });

      // Verify error was shown
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌'));
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('too short'));

      // Verify tokens were eventually saved
      expect(mockSave).toHaveBeenCalled();
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
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('expired'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/\d+ days ago/));
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
    it('should refresh tokens when refresh token exists', async () => {
      // Mock valid tokens
      const mockTokens: TokenFile = {
        anthropic: {
          type: 'oauth',
          access: 'sk-ant-oat01-validaccesstoken1234567890',
          refresh: 'sk-ant-ort01-validrefreshtoken1234567890',
          expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
        },
      };
      mockLoad.mockResolvedValue(mockTokens);

      await command.parseAsync(['refresh'], { from: 'user' });

      // Verify refresh message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Refreshing tokens'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Tokens refreshed successfully'));
    });

    it('should handle missing token file during refresh', async () => {
      // Mock token file not found
      mockLoad.mockRejectedValue(new Error('Token file not found'));

      try {
        await command.parseAsync(['refresh'], { from: 'user' });
      } catch (error) {
        expect(String(error)).toContain('process.exit');
      }

      // Verify error message
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('❌ No refresh token found'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Run: workbench auth'));
    });
  });

  describe('File Operations', () => {
    it('should save tokens with correct expiry timestamp', async () => {
      const beforeTimestamp = Date.now();

      mockQuestion
        .mockResolvedValueOnce('sk-ant-oat01-validaccesstoken1234567890')
        .mockResolvedValueOnce('sk-ant-ort01-validrefreshtoken1234567890');

      await command.parseAsync([], { from: 'user' });

      // Get the saved token data
      const savedTokens = mockSave.mock.calls[0][0] as TokenFile;
      const expiresTimestamp = savedTokens.anthropic.expires;

      // Verify expiry is approximately 90 days from now
      const expectedExpiry = beforeTimestamp + 90 * 24 * 60 * 60 * 1000;
      const tolerance = 5000; // 5 seconds tolerance
      expect(expiresTimestamp).toBeGreaterThanOrEqual(expectedExpiry - tolerance);
      expect(expiresTimestamp).toBeLessThanOrEqual(expectedExpiry + tolerance);
    });

    it('should trim whitespace from tokens', async () => {
      // Mock tokens with leading/trailing whitespace
      mockQuestion
        .mockResolvedValueOnce('  sk-ant-oat01-validaccesstoken1234567890  ')
        .mockResolvedValueOnce('\tsk-ant-ort01-validrefreshtoken1234567890\n');

      await command.parseAsync([], { from: 'user' });

      // Verify tokens were trimmed before saving
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          anthropic: expect.objectContaining({
            access: 'sk-ant-oat01-validaccesstoken1234567890',
            refresh: 'sk-ant-ort01-validrefreshtoken1234567890',
          }),
        })
      );
    });
  });
});
