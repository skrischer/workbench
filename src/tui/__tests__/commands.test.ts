// src/tui/__tests__/commands.test.ts — Slash-command tests

import { describe, it, expect, vi } from 'vitest';
import { executeSlashCommand, COMMANDS, type CommandContext } from '../commands.js';

function createMockContext(): CommandContext {
  return {
    createSession: vi.fn().mockResolvedValue('new-session-id'),
    resumeSession: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([]),
    setError: vi.fn(),
  };
}

describe('Slash Commands', () => {
  it('should register /new, /resume, /help commands', () => {
    const names = COMMANDS.map((c) => c.name);
    expect(names).toContain('new');
    expect(names).toContain('resume');
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
});
