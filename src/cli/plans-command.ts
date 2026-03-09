// src/cli/plans-command.ts — CLI plans command implementation

import { Command } from 'commander';
import { PlanStorage } from '../task/plan-storage.js';
import type { PlanStatus } from '../types/task.js';

/**
 * CLI plans command options
 */
export interface PlansCommandOptions {
  status?: string;
}

/**
 * Format plan list as a table for console output
 */
export function formatPlanList(
  plans: Array<{
    id: string;
    title: string;
    status: PlanStatus;
    stepCount: number;
    createdAt: string;
    updatedAt: string;
  }>
): string {
  if (plans.length === 0) {
    return '\n📋 No plans found\n';
  }

  const lines: string[] = [];
  
  lines.push('');
  lines.push(`📋 Plans (${plans.length})`);
  lines.push('─────────────────────────────────────────────────────────────────────');
  
  // Calculate column widths
  const idWidth = 36; // UUID
  const statusWidth = 12;
  const stepsWidth = 8;
  const maxTitleWidth = 40;
  
  // Header
  lines.push(
    `${'ID'.padEnd(idWidth)} | ` +
    `${'Status'.padEnd(statusWidth)} | ` +
    `${'Steps'.padEnd(stepsWidth)} | ` +
    `Title`
  );
  lines.push('─────────────────────────────────────────────────────────────────────');
  
  // Rows
  plans.forEach((plan) => {
    const id = plan.id.substring(0, idWidth);
    const status = plan.status.padEnd(statusWidth);
    const steps = `${plan.stepCount}`.padEnd(stepsWidth);
    const title = plan.title.length > maxTitleWidth 
      ? plan.title.substring(0, maxTitleWidth - 3) + '...'
      : plan.title;
    
    lines.push(`${id} | ${status} | ${steps} | ${title}`);
  });
  
  lines.push('─────────────────────────────────────────────────────────────────────');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Execute the 'plans' command
 * @param options - CLI options
 */
export async function plansCommand(options: PlansCommandOptions): Promise<void> {
  try {
    // 1. Create PlanStorage
    const planStorage = new PlanStorage();

    // 2. List all plans (with no limit for CLI)
    const result = await planStorage.list({ limit: 1000 });
    let plans = result.data;

    // 3. Filter by status if requested
    if (options.status) {
      const statusFilter = options.status.toLowerCase() as PlanStatus;
      plans = plans.filter((plan) => plan.status === statusFilter);
    }

    // 4. Sort by creation date (newest first) - already sorted by storage, but filter may have changed order
    plans.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 5. Format and display
    const output = formatPlanList(plans);
    console.log(output);

    // 6. Show filter info if applied
    if (options.status) {
      console.error(`Filtered by status: ${options.status}`);
      console.error('');
    }

    process.exit(0);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to list plans: ${message}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Create the plans command for Commander.js
 */
export function createPlansCommand(): Command {
  const command = new Command('plans');
  
  command
    .description('List all execution plans')
    .option('--status <status>', 'Filter by status (pending, running, completed, failed, paused)')
    .action(async (options: PlansCommandOptions) => {
      await plansCommand(options);
    });
  
  return command;
}
