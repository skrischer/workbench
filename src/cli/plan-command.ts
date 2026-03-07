// src/cli/plan-command.ts — CLI plan command implementation

import { homedir } from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { AnthropicClient } from '../llm/anthropic-client.js';
import { TokenRefresher } from '../llm/token-refresh.js';
import { TokenStorage } from '../llm/token-storage.js';
import { PlanGenerator } from '../task/plan-generator.js';
import { PlanStorage } from '../task/plan-storage.js';
import type { Plan } from '../types/task.js';

/**
 * CLI plan command options
 */
export interface PlanCommandOptions {
  autoRun?: boolean;
  model?: string;
}

/**
 * Format plan as a table for console output
 */
export function formatPlanPreview(plan: Plan): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push(`📋 ${plan.title}`);
  lines.push(`📝 ${plan.description}`);
  lines.push('');
  lines.push('Steps:');
  lines.push('─────────────────────────────────────────');
  
  // Calculate column widths
  const idWidth = 8;
  const statusWidth = 10;
  const maxTitleWidth = 50;
  
  // Header
  lines.push(
    `${'#'.padEnd(idWidth)} | ` +
    `${'Status'.padEnd(statusWidth)} | ` +
    `Title`
  );
  lines.push('─────────────────────────────────────────');
  
  // Rows
  plan.steps.forEach((step, index) => {
    const stepNum = `${index + 1}`.padEnd(idWidth);
    const status = step.status.padEnd(statusWidth);
    const title = step.title.length > maxTitleWidth 
      ? step.title.substring(0, maxTitleWidth - 3) + '...'
      : step.title;
    
    lines.push(`${stepNum} | ${status} | ${title}`);
  });
  
  lines.push('─────────────────────────────────────────');
  lines.push(`Plan ID: ${plan.id}`);
  lines.push(`Total Steps: ${plan.steps.length}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Execute the 'plan' command
 * @param prompt - User prompt to generate plan for
 * @param options - CLI options
 */
export async function planCommand(prompt: string, options: PlanCommandOptions): Promise<void> {
  try {
    // 1. Create TokenStorage
    const tokenPath = path.join(homedir(), '.workbench', 'tokens.json');
    const tokenStorage = new TokenStorage(tokenPath);

    // 2. Create TokenRefresher
    let tokenRefresher: TokenRefresher;
    try {
      tokenRefresher = new TokenRefresher(tokenStorage);
      await tokenStorage.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`❌ Token error: ${message}`);
      console.error('');
      console.error('💡 Setup required:');
      console.error('   1. Create ~/.workbench directory');
      console.error('   2. Authorize via OAuth and save tokens to ~/.workbench/tokens.json');
      console.error('');
      process.exit(1);
    }

    // 3. Create AnthropicClient
    const model = options.model ?? 'claude-3-5-sonnet-20241022';
    const anthropicClient = new AnthropicClient(tokenRefresher, { model });

    // 4. Create PlanGenerator
    const planGenerator = new PlanGenerator({
      model,
      llmCall: async (messages) => {
        // Convert messages to Anthropic format
        const systemMessage = messages.find(m => m.role === 'system');
        const userMessages = messages.filter(m => m.role === 'user');
        
        const response = await anthropicClient.sendMessage(
          userMessages.map(m => ({
            role: 'user' as const,
            content: m.content,
          })),
          undefined,
          { system: systemMessage?.content ?? '' }
        );

        // Extract text from response
        const textContent = response.content.find((c: { type: string }) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in LLM response');
        }
        
        return textContent.text;
      },
    });

    // 5. Generate plan
    console.error(`🤔 Generating plan for: "${prompt}"`);
    console.error(`📋 Model: ${model}`);
    console.error('');

    const plan = await planGenerator.generate(prompt);

    // 6. Save plan to storage
    const planStorage = new PlanStorage();
    await planStorage.create(plan);

    // 7. Display plan preview
    const preview = formatPlanPreview(plan);
    console.log(preview);

    console.error('✅ Plan generated and saved');
    console.error('');
    console.error(`Run with: workbench run-plan ${plan.id}`);
    console.error('');

    // 8. Auto-run if requested
    if (options.autoRun) {
      console.error('🚀 Auto-running plan...');
      console.error('');
      
      // Import dynamically to avoid circular dependency
      const { runPlanCommand } = await import('./run-plan-command.js');
      await runPlanCommand(plan.id, {});
    }

    process.exit(0);

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to generate plan: ${message}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Create the plan command for Commander.js
 */
export function createPlanCommand(): Command {
  const command = new Command('plan');
  
  command
    .description('Generate an execution plan from a prompt')
    .argument('<prompt>', 'User prompt to generate plan for')
    .option('--auto-run', 'Automatically run the plan after generation')
    .option('--model <model>', 'Override LLM model')
    .action(async (prompt: string, options: PlanCommandOptions) => {
      await planCommand(prompt, options);
    });
  
  return command;
}
