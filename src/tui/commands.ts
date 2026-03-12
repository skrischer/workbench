// src/tui/commands.ts — Slash-commands for the TUI

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

export const COMMANDS: SlashCommand[] = [newCommand, resumeCommand, helpCommand];

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
