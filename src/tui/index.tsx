#!/usr/bin/env node
// src/tui/index.tsx — TUI Entry Point

import { Command } from 'commander';
import { createAuthCommand, interactiveAuth } from './commands/auth-command.js';
import { createGatewayCommand } from '../cli/gateway-command.js';
import { TokenStorage } from '../llm/token-storage.js';
import { TokenRefresher } from '../llm/token-refresh.js';

/**
 * Ensure valid auth tokens before TUI startup.
 * Tries: load → refresh → interactive OAuth flow.
 */
async function ensureAuth(): Promise<void> {
  const storage = new TokenStorage();

  // 1. Try loading existing tokens
  let needsAuth = false;
  try {
    const tokens = await storage.load();
    if (storage.isExpired(tokens.anthropic)) {
      // 2. Token expired — try refresh
      console.log('Token expired, refreshing...');
      try {
        const refresher = new TokenRefresher(storage);
        await refresher.ensureValidToken();
        console.log('Token refreshed successfully.\n');
        return;
      } catch {
        console.log('Token refresh failed.\n');
        needsAuth = true;
      }
    } else {
      return; // Valid token exists
    }
  } catch {
    needsAuth = true;
  }

  if (needsAuth) {
    console.log('No valid authentication found.\n');
    await interactiveAuth();
    console.log('');
  }
}

const program = new Command();

program
  .name('workbench')
  .description('Workbench — AI Dev OS')
  .version('0.1.0');

// Register commands
program.addCommand(createAuthCommand());
program.addCommand(createGatewayCommand());

// Check if a subcommand was provided
const args = process.argv.slice(2);
const subcommands = ['auth', 'gateway', '--help', '-h', '--version', '-V'];
const hasSubcommand = args.length > 0 && subcommands.some((cmd) => args[0] === cmd);

if (hasSubcommand || !process.stdout.isTTY) {
  // Commander.js handles the subcommand or non-interactive mode
  program.parse();
} else {
  // Interactive TUI mode
  const startTUI = async (): Promise<void> => {
    await ensureAuth();
    const { render } = await import('ink');
    const React = await import('react');
    const { App } = await import('./app.js');
    render(React.createElement(App));
  };
  void startTUI();
}
