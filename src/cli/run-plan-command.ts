// src/cli/run-plan-command.ts — CLI run-plan command implementation

import { homedir } from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { TypedEventBus } from '../events/event-bus.js';
import { AnthropicClient } from '../llm/anthropic-client.js';
import { TokenRefresher } from '../llm/token-refresh.js';
import { TokenStorage } from '../llm/token-storage.js';
import { CoreAgentLoop } from '../runtime/core-agent-loop.js';
import { SessionStorage } from '../storage/session-storage.js';
import { PlanExecutor } from '../task/plan-executor.js';
import { PlanStorage } from '../task/plan-storage.js';
import { createDefaultTools } from '../tools/defaults.js';
import { ToolRegistry } from '../tools/registry.js';
import type { EventMap } from '../types/events.js';
import type { Step, StepResult } from '../types/task.js';
import { DEFAULT_MODEL } from '../config/index.js';

/**
 * CLI run-plan command options
 */
export interface RunPlanCommandOptions {
  resume?: boolean;
  model?: string;
}

/**
 * Execute the 'run-plan' command
 * @param planId - The plan ID to execute
 * @param options - CLI options
 */
export async function runPlanCommand(planId: string, options: RunPlanCommandOptions): Promise<void> {
  try {
    // 1. Create dependencies
    const workbenchHome = process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
    const tokenPath = path.join(workbenchHome, 'tokens.json');
    const tokenStorage = new TokenStorage(tokenPath);

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

    const model = options.model ?? DEFAULT_MODEL;
    const anthropicClient = new AnthropicClient(tokenRefresher, {
      model,
      apiUrl: process.env.ANTHROPIC_API_URL,
    });
    const toolRegistry = createDefaultTools();
    const sessionStorage = new SessionStorage();
    const planStorage = new PlanStorage();
    const eventBus = new TypedEventBus<EventMap>();

    // 2. Load plan to show initial status
    const plan = await planStorage.load(planId);
    console.error('');
    console.error(`📋 Plan: ${plan.title}`);
    console.error(`📝 ${plan.description}`);
    console.error(`🔢 Steps: ${plan.steps.length}`);
    console.error(`📊 Status: ${plan.status}`);
    console.error('');

    // 3. Set up event handlers for progress reporting
    eventBus.on('plan:start', (event) => {
      console.error(`🚀 Starting plan execution: ${event.title}`);
      console.error(`   Total steps: ${event.stepCount}`);
      console.error('');
    });

    eventBus.on('plan:step:start', (event) => {
      console.error(`▶️  Step ${event.stepIndex + 1}/${plan.steps.length}: ${event.stepTitle}`);
    });

    eventBus.on('plan:step:end', (event) => {
      const duration = (event.durationMs / 1000).toFixed(1);
      const emoji = event.status === 'completed' ? '✅' : '❌';
      console.error(`${emoji} Step ${event.stepIndex + 1} ${event.status} (${duration}s)`);
      console.error('');
    });

    eventBus.on('plan:end', (event) => {
      console.error('─────────────────────────────────────────');
      console.error(`✅ Plan execution ${event.status}`);
      console.error(`📊 Completed: ${event.completedSteps}/${event.totalSteps} steps`);
      console.error('─────────────────────────────────────────');
    });

    // 4. Create StepRunner that uses CoreAgentLoop
    const stepRunner = async (step: Step): Promise<StepResult> => {
      const startTime = Date.now();

      try {
        // Create agent config for this step
        const agentConfig = {
          model,
          maxSteps: step.maxSteps ?? 10,
          systemPrompt: 'You are a helpful AI assistant executing a plan step.',
        };

        // Create agent loop
        const agentLoop = new CoreAgentLoop(
          anthropicClient,
          sessionStorage,
          toolRegistry,
          agentConfig
        );

        // Run the step
        const result = await agentLoop.run(step.prompt);

        // Return step result
        return {
          output: result.finalResponse,
          tokenUsage: {
            totalInputTokens: result.tokenUsage.input_tokens,
            totalOutputTokens: result.tokenUsage.output_tokens,
            totalCacheReadTokens: 0,
            totalCacheWriteTokens: 0,
            totalTokens: result.tokenUsage.input_tokens + result.tokenUsage.output_tokens,
            stepCount: result.steps,
          },
          filesModified: [], // TODO: Track file modifications
          durationMs: Date.now() - startTime,
          error: result.status === 'failed' ? 'Agent execution failed' : undefined,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          output: '',
          tokenUsage: {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCacheReadTokens: 0,
            totalCacheWriteTokens: 0,
            totalTokens: 0,
            stepCount: 0,
          },
          filesModified: [],
          durationMs: Date.now() - startTime,
          error: message,
        };
      }
    };

    // 5. Create PlanExecutor
    const executor = new PlanExecutor({
      planStorage,
      eventBus,
      stepRunner,
    });

    // 6. Execute or resume
    if (options.resume) {
      console.error('🔄 Resuming plan execution...');
      console.error('');
      await executor.resume(planId);
    } else {
      await executor.execute(planId);
    }

    // 7. Load final plan state and show summary
    const finalPlan = await planStorage.load(planId);
    console.error('');
    
    if (finalPlan.metadata.totalTokenUsage) {
      const usage = finalPlan.metadata.totalTokenUsage;
      console.error(`💰 Total Token Usage:`);
      console.error(`   Input: ${usage.totalInputTokens}`);
      console.error(`   Output: ${usage.totalOutputTokens}`);
      console.error(`   Cache Read: ${usage.totalCacheReadTokens}`);
      console.error(`   Cache Write: ${usage.totalCacheWriteTokens}`);
      console.error(`   Total: ${usage.totalTokens}`);
      console.error('');
    }

    // Exit with appropriate code
    if (finalPlan.status === 'failed') {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to execute plan: ${message}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Create the run-plan command for Commander.js
 */
export function createRunPlanCommand(): Command {
  const command = new Command('run-plan');
  
  command
    .description('Execute a plan by ID')
    .argument('<plan-id>', 'Plan ID to execute')
    .option('--resume', 'Resume a paused or failed plan from current step')
    .option('--model <model>', 'Override LLM model')
    .action(async (planId: string, options: RunPlanCommandOptions) => {
      await runPlanCommand(planId, options);
    });
  
  return command;
}
