#!/usr/bin/env node
import { Command } from 'commander';
import { runCommand } from './run-command.js';
import { createAuthCommand } from './auth-command.js';
import { createConfigCommand } from './config-command.js';

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
    await runCommand(prompt, options);
  });

// Register auth command
program.addCommand(createAuthCommand());

// Register config command
program.addCommand(createConfigCommand());

program.parse();
