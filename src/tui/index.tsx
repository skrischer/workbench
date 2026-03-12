#!/usr/bin/env node
// src/tui/index.tsx — TUI Entry Point

import { Command } from 'commander';
import { createAuthCommand } from './commands/auth-command.js';
import { createConfigCommand } from './commands/config-command.js';
import { createWebCommand } from '../cli/web-command.js';

const program = new Command();

program
  .name('workbench')
  .description('Workbench — AI Dev OS')
  .version('0.1.0');

program
  .command('status')
  .description('Show workbench status')
  .action(() => {
    console.log('🔧 Workbench v0.1.0 — Ready');
  });

program
  .command('run')
  .description('Run agent with a prompt')
  .argument('<prompt>', 'User prompt to process')
  .option('--model <model>', 'Override LLM model')
  .option('--max-steps <n>', 'Override max steps', parseInt)
  .option('--config <path>', 'Path to agent config JSON file')
  .option('--no-summarize', 'Disable automatic session summarization')
  .action(async (prompt: string, options: { model?: string; maxSteps?: number; config?: string; noSummarize?: boolean }) => {
    // In non-interactive mode (piped / no TTY), use the classic run command
    const { runCommand } = await import('./commands/run-command.js');
    await runCommand(prompt, options);
  });

// Register auth command
program.addCommand(createAuthCommand());

// Register config command
program.addCommand(createConfigCommand());

// Register web command
program.addCommand(createWebCommand());

// Check if a subcommand was provided
const args = process.argv.slice(2);
const subcommands = ['status', 'run', 'auth', 'config', 'web', '--help', '-h', '--version', '-V'];
const hasSubcommand = args.length > 0 && subcommands.some((cmd) => args[0] === cmd);

if (hasSubcommand || !process.stdout.isTTY) {
  // Commander.js handles the subcommand or non-interactive mode
  program.parse();
} else {
  // Interactive TUI mode
  const startTUI = async (): Promise<void> => {
    const { render } = await import('ink');
    const React = await import('react');
    const { App } = await import('./app.js');
    render(React.createElement(App));
  };
  void startTUI();
}
