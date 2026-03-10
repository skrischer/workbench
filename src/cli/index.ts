#!/usr/bin/env node
import { Command } from 'commander';
import { runCommand } from './run-command.js';
import { createPlanCommand } from './plan-command.js';
import { createRunPlanCommand } from './run-plan-command.js';
import { createPlansCommand } from './plans-command.js';
import { createDashboardCommand } from './dashboard-command.js';
import { createWorkflowCommands } from './workflow-commands.js';
import { createAuthCommand } from './auth-command.js';
import { createCleanupCommand } from './cleanup-command.js';

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
  .action(async (prompt: string, options: { model?: string; maxSteps?: number; config?: string }) => {
    await runCommand(prompt, options);
  });

// Register plan-related commands
program.addCommand(createPlanCommand());
program.addCommand(createRunPlanCommand());
program.addCommand(createPlansCommand());

// Register dashboard command
program.addCommand(createDashboardCommand());

// Register auth command
program.addCommand(createAuthCommand());

// Register cleanup command
program.addCommand(createCleanupCommand());

// Register workflow commands
for (const cmd of createWorkflowCommands()) {
  program.addCommand(cmd);
}

program.parse();
