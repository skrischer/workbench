// src/tui/__tests__/commands.test.ts — Slash-command tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSlashCommand, COMMANDS, type CommandContext } from '../commands.js';

const mockLoad = vi.fn();
const mockEnsureValidToken = vi.fn();

vi.mock('../../llm/token-storage.js', () => ({
  TokenStorage: class MockTokenStorage {
    load = mockLoad;
    save = vi.fn();
  },
}));

vi.mock('../../llm/token-refresh.js', () => ({
  TokenRefresher: class MockTokenRefresher {
    ensureValidToken = mockEnsureValidToken;
  },
}));

function createMockContext(): CommandContext {
  return {
    createSession: vi.fn().mockResolvedValue('new-session-id'),
    resumeSession: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([]),
    setError: vi.fn(),
  };
}

describe('Slash Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register /new, /resume, /auth, /help commands', () => {
    const names = COMMANDS.map((c) => c.name);
    expect(names).toContain('new');
    expect(names).toContain('resume');
    expect(names).toContain('auth');
    expect(names).toContain('help');
  });

  it('should execute /new command', async () => {
    const ctx = createMockContext();
    const handled = await executeSlashCommand('/new', ctx);
    expect(handled).toBe(true);
    expect(ctx.createSession).toHaveBeenCalled();
  });

  it('should execute /resume with session id', async () => {
    const ctx = createMockContext();
    const handled = await executeSlashCommand('/resume abc-123', ctx);
    expect(handled).toBe(true);
    expect(ctx.resumeSession).toHaveBeenCalledWith('abc-123');
  });

  it('should show error for /resume without id', async () => {
    const ctx = createMockContext();
    const handled = await executeSlashCommand('/resume', ctx);
    expect(handled).toBe(true);
    expect(ctx.setError).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });

  it('should execute /help command', async () => {
    const ctx = createMockContext();
    const handled = await executeSlashCommand('/help', ctx);
    expect(handled).toBe(true);
    expect(ctx.setError).toHaveBeenCalledWith(expect.stringContaining('Available commands'));
  });

  it('should handle unknown commands', async () => {
    const ctx = createMockContext();
    const handled = await executeSlashCommand('/unknown', ctx);
    expect(handled).toBe(true);
    expect(ctx.setError).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
  });

  it('should return false for non-command input', async () => {
    const ctx = createMockContext();
    const handled = await executeSlashCommand('hello world', ctx);
    expect(handled).toBe(false);
  });

  describe('/auth command', () => {
    it('should show token status when configured', async () => {
      mockLoad.mockResolvedValue({
        anthropic: {
          type: 'oauth',
          access: 'sk-ant-oat01-validaccesstoken1234567890',
          refresh: 'sk-ant-ort01-validrefreshtoken1234567890',
          expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
        },
      });

      const ctx = createMockContext();
      await executeSlashCommand('/auth', ctx);
      expect(ctx.setError).toHaveBeenCalledWith(expect.stringContaining('Configured'));
      expect(ctx.setError).toHaveBeenCalledWith(expect.stringContaining('sk-ant-oat01-'));
    });

    it('should show error when no tokens exist', async () => {
      mockLoad.mockRejectedValue(new Error('Token file not found'));

      const ctx = createMockContext();
      await executeSlashCommand('/auth status', ctx);
      expect(ctx.setError).toHaveBeenCalledWith(expect.stringContaining('No tokens configured'));
    });

    it('should show expired state', async () => {
      mockLoad.mockResolvedValue({
        anthropic: {
          type: 'oauth',
          access: 'sk-ant-oat01-expiredtoken1234567890abc',
          refresh: 'sk-ant-ort01-expiredrefresh1234567890abc',
          expires: Date.now() - 1000,
        },
      });

      const ctx = createMockContext();
      await executeSlashCommand('/auth status', ctx);
      expect(ctx.setError).toHaveBeenCalledWith(expect.stringContaining('Expired'));
    });

    it('should refresh tokens successfully', async () => {
      mockEnsureValidToken.mockResolvedValue('sk-ant-oat01-newtoken');

      const ctx = createMockContext();
      await executeSlashCommand('/auth refresh', ctx);
      expect(ctx.setError).toHaveBeenCalledWith(expect.stringContaining('refreshed successfully'));
    });

    it('should handle refresh failure', async () => {
      mockEnsureValidToken.mockRejectedValue(new Error('Token file not found'));

      const ctx = createMockContext();
      await executeSlashCommand('/auth refresh', ctx);
      expect(ctx.setError).toHaveBeenCalledWith(expect.stringContaining('No tokens found'));
    });

    it('should show usage for unknown subcommand', async () => {
      const ctx = createMockContext();
      await executeSlashCommand('/auth setup', ctx);
      expect(ctx.setError).toHaveBeenCalledWith(expect.stringContaining('Usage'));
    });
  });
});
