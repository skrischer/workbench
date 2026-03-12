// src/tui/commands.ts — Slash-commands for the TUI

import { TokenStorage } from '../llm/token-storage.js';
import { TokenRefresher } from '../llm/token-refresh.js';

export interface CommandContext {
  createSession: () => Promise<string>;
  resumeSession: (sessionId: string) => void;
  listSessions: () => Promise<Array<{ id: string; status: string; promptPreview: string }>>;
  setError: (msg: string) => void;
}

export interface SlashCommand {
  name: string;
  description: string;
  execute(args: string[], context: CommandContext): Promise<void>;
}

const newCommand: SlashCommand = {
  name: 'new',
  description: 'Create a new session',
  async execute(_args: string[], context: CommandContext): Promise<void> {
    await context.createSession();
  },
};

const resumeCommand: SlashCommand = {
  name: 'resume',
  description: 'Resume an existing session. Usage: /resume [session-id]',
  async execute(args: string[], context: CommandContext): Promise<void> {
    const sessionId = args[0];
    if (!sessionId) {
      context.setError('Usage: /resume <session-id>');
      return;
    }
    context.resumeSession(sessionId);
  },
};

const helpCommand: SlashCommand = {
  name: 'help',
  description: 'Show available commands',
  async execute(_args: string[], context: CommandContext): Promise<void> {
    const lines = COMMANDS.map((cmd) => `  /${cmd.name} — ${cmd.description}`);
    context.setError('Available commands:\n' + lines.join('\n'));
  },
};

function formatTimeUntilExpiry(expiresTimestamp: number): string {
  const msUntilExpiry = expiresTimestamp - Date.now();
  if (msUntilExpiry < 0) return 'Expired';
  const hours = Math.floor(msUntilExpiry / (1000 * 60 * 60));
  const minutes = Math.floor((msUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)} days`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function maskToken(token: string): string {
  if (token.length < 10) return '***';
  const prefix = token.slice(0, token.indexOf('-', 10) + 1);
  return `${prefix}***${token.slice(-3)}`;
}

const authCommand: SlashCommand = {
  name: 'auth',
  description: 'Token status & refresh. Usage: /auth [status|refresh]',
  async execute(args: string[], context: CommandContext): Promise<void> {
    const sub = args[0]?.toLowerCase() ?? 'status';
    const storage = new TokenStorage();

    if (sub === 'status') {
      try {
        const tokens = await storage.load();
        const { anthropic } = tokens;
        const expiry = formatTimeUntilExpiry(anthropic.expires);
        const expired = Date.now() >= anthropic.expires;
        context.setError(
          `Auth: ${expired ? '✗ Expired' : '✓ Configured'}\n` +
          `Token: ${maskToken(anthropic.access)}\n` +
          `Expires in: ${expiry}`
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          context.setError('Auth: ✗ No tokens configured.\nRun "workbench auth" in a terminal to set up.');
        } else {
          context.setError(`Auth error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } else if (sub === 'refresh') {
      try {
        const refresher = new TokenRefresher(storage);
        await refresher.ensureValidToken();
        context.setError('Auth: ✓ Tokens refreshed successfully.');
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          context.setError('Auth: No tokens found. Run "workbench auth" to set up.');
        } else {
          context.setError(`Auth refresh failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    } else {
      context.setError('Usage: /auth [status|refresh]');
    }
  },
};

export const COMMANDS: SlashCommand[] = [newCommand, resumeCommand, authCommand, helpCommand];

/**
 * Parse and execute a slash command.
 * Returns true if the input was a command, false otherwise.
 */
export async function executeSlashCommand(
  input: string,
  context: CommandContext
): Promise<boolean> {
  if (!input.startsWith('/')) return false;

  const parts = input.slice(1).split(/\s+/);
  const cmdName = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  const command = COMMANDS.find((c) => c.name === cmdName);
  if (!command) {
    context.setError(`Unknown command: /${cmdName}. Type /help for available commands.`);
    return true;
  }

  await command.execute(args, context);
  return true;
}
