// src/cli/workflow-commands.ts — Workflow CLI Commands

import { homedir } from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import { WorkflowRegistry } from '../workflows/registry.js';
import { WorkflowRunner } from '../workflows/runner.js';
import { testFixerWorkflow } from '../workflows/test-fixer.js';
import { codeReviewerWorkflow } from '../workflows/code-reviewer.js';
import { refactorWorkflow } from '../workflows/refactor-agent.js';
import { docsWorkflow } from '../workflows/docs-agent.js';
import { AnthropicClient } from '../llm/anthropic-client.js';
import { TokenRefresher } from '../llm/token-refresh.js';
import { TokenStorage } from '../llm/token-storage.js';
import { SessionStorage } from '../storage/session-storage.js';
import { createDefaultTools } from '../tools/defaults.js';
import { TypedEventBus } from '../events/event-bus.js';
import type { WorkflowInput, WorkflowResult } from '../types/workflow.js';

/**
 * Create a registry with all workflow definitions.
 */
function createRegistry(): WorkflowRegistry {
  const registry = new WorkflowRegistry();
  registry.register(testFixerWorkflow);
  registry.register(codeReviewerWorkflow);
  registry.register(refactorWorkflow);
  registry.register(docsWorkflow);
  return registry;
}

/**
 * Create workflow dependencies (AnthropicClient, SessionStorage, ToolRegistry, EventBus).
 * @throws Error if token storage is not configured
 */
async function createWorkflowDependencies() {
  // 1. Create TokenStorage (default path: ~/.workbench/tokens.json)
  const workbenchHome = process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
  const tokenPath = path.join(workbenchHome, 'tokens.json');
  const tokenStorage = new TokenStorage(tokenPath);

  // 2. Create TokenRefresher
  let tokenRefresher: TokenRefresher;
  try {
    tokenRefresher = new TokenRefresher(tokenStorage);
    // Verify token file exists by attempting to load
    await tokenStorage.load();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Token error: ${message}\n\n💡 Setup required:\n   1. Create ~/.workbench directory\n   2. Authorize via OAuth and save tokens to ~/.workbench/tokens.json`);
  }

  // 3. Create AnthropicClient
  const anthropicClient = new AnthropicClient(tokenRefresher, {
    apiUrl: process.env.ANTHROPIC_API_URL,
  });

  // 4. Create ToolRegistry with default tools
  const toolRegistry = createDefaultTools();

  // 5. Create SessionStorage
  const sessionStorage = new SessionStorage();

  // 6. Create EventBus
  const eventBus = new TypedEventBus();

  return {
    anthropicClient,
    sessionStorage,
    toolRegistry,
    eventBus,
  };
}

/**
 * Format workflow result for console output.
 */
function formatResult(result: WorkflowResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('─────────────────────────────────────────');
  lines.push(`📋 Workflow: ${result.workflowId}`);
  lines.push(`✅ Status: ${result.status}`);
  lines.push(`⏱️  Duration: ${result.durationMs}ms`);
  lines.push('─────────────────────────────────────────');
  lines.push('');
  lines.push(result.output);
  lines.push('');
  
  if (result.filesModified.length > 0) {
    lines.push('📝 Files Modified:');
    result.filesModified.forEach(file => {
      lines.push(`   - ${file}`);
    });
    lines.push('');
  }
  
  lines.push('📊 Token Usage:');
  lines.push(`   Input:  ${result.tokenUsage.totalInputTokens}`);
  lines.push(`   Output: ${result.tokenUsage.totalOutputTokens}`);
  lines.push(`   Total:  ${result.tokenUsage.totalTokens}`);
  lines.push(`   Steps:  ${result.tokenUsage.stepCount}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Create the 'fix-tests' command.
 */
function createFixTestsCommand(): Command {
  const cmd = new Command('fix-tests');
  
  cmd
    .description('Analyze and fix failing tests')
    .option('--filter <pattern>', 'Test filter pattern')
    .option('--max-attempts <n>', 'Maximum fix attempts', parseInt, 5)
    .action(async (options: { filter?: string; maxAttempts?: number }) => {
      try {
        // 1. Get workflow definition from registry
        const registry = createRegistry();
        const definition = registry.get('test-fixer');
        if (!definition) {
          throw new Error(`Workflow 'test-fixer' not found`);
        }

        // 2. Create workflow dependencies
        const deps = await createWorkflowDependencies();

        // 3. Create workflow runner with definition and dependencies
        const runner = new WorkflowRunner(
          definition,
          deps.anthropicClient,
          deps.sessionStorage,
          deps.toolRegistry,
          deps.eventBus
        );
        
        // 4. Run workflow with params (no workflowId needed)
        const params = {
          testCommand: 'npm test',
          testFilter: options.filter,
          maxAttempts: options.maxAttempts ?? 5,
        };
        
        const result = await runner.run(params);
        console.log(formatResult(result));
        
        process.exit(result.status === 'completed' ? 0 : 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error: ${message}`);
        process.exit(1);
      }
    });
  
  return cmd;
}

/**
 * Create the 'review' command.
 */
function createReviewCommand(): Command {
  const cmd = new Command('review');
  
  cmd
    .description('Review code changes in a Git branch')
    .argument('<branch>', 'Branch to review')
    .option('--base <branch>', 'Base branch to compare against', 'main')
    .option('--focus <area>', 'Focus area: security, performance, tests, style')
    .action(async (branch: string, options: { base?: string; focus?: string }) => {
      try {
        // 1. Get workflow definition from registry
        const registry = createRegistry();
        const definition = registry.get('code-reviewer');
        if (!definition) {
          throw new Error(`Workflow 'code-reviewer' not found`);
        }

        // 2. Create workflow dependencies
        const deps = await createWorkflowDependencies();

        // 3. Create workflow runner with definition and dependencies
        const runner = new WorkflowRunner(
          definition,
          deps.anthropicClient,
          deps.sessionStorage,
          deps.toolRegistry,
          deps.eventBus
        );
        
        // 4. Run workflow with params (no workflowId needed)
        const params = {
          branch,
          baseBranch: options.base ?? 'main',
          focus: options.focus,
        };
        
        const result = await runner.run(params);
        console.log(formatResult(result));
        
        process.exit(result.status === 'completed' ? 0 : 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error: ${message}`);
        process.exit(1);
      }
    });
  
  return cmd;
}

/**
 * Create the 'refactor' command.
 */
function createRefactorCommand(): Command {
  const cmd = new Command('refactor');
  
  cmd
    .description('Perform code refactoring')
    .argument('<target>', 'Target file or symbol to refactor')
    .requiredOption('--type <type>', 'Refactoring type: extract-method, rename, move, dead-code, simplify, general')
    .option('--dry-run', 'Preview changes without applying them')
    .option('--description <desc>', 'Description of the refactoring')
    .action(async (
      target: string,
      options: { type: string; dryRun?: boolean; description?: string }
    ) => {
      try {
        // 1. Get workflow definition from registry
        const registry = createRegistry();
        const definition = registry.get('refactor');
        if (!definition) {
          throw new Error(`Workflow 'refactor' not found`);
        }

        // 2. Create workflow dependencies
        const deps = await createWorkflowDependencies();

        // 3. Create workflow runner with definition and dependencies
        const runner = new WorkflowRunner(
          definition,
          deps.anthropicClient,
          deps.sessionStorage,
          deps.toolRegistry,
          deps.eventBus
        );
        
        // 4. Run workflow with params (no workflowId needed)
        const params = {
          target,
          type: options.type,
          dryRun: options.dryRun ?? false,
          description: options.description,
        };
        
        const result = await runner.run(params);
        console.log(formatResult(result));
        
        process.exit(result.status === 'completed' ? 0 : 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error: ${message}`);
        process.exit(1);
      }
    });
  
  return cmd;
}

/**
 * Create the 'docs' command.
 */
function createDocsCommand(): Command {
  const cmd = new Command('docs');
  
  cmd
    .description('Generate or update documentation')
    .requiredOption('--type <type>', 'Documentation type: readme, jsdoc, api, changelog, general')
    .option('--target <path>', 'Target file or directory', 'src/')
    .option('--style <style>', 'Documentation style: concise, detailed, tutorial')
    .option('--update', 'Update existing documentation instead of creating new')
    .action(async (options: {
      type: string;
      target?: string;
      style?: string;
      update?: boolean;
    }) => {
      try {
        // 1. Get workflow definition from registry
        const registry = createRegistry();
        const definition = registry.get('docs');
        if (!definition) {
          throw new Error(`Workflow 'docs' not found`);
        }

        // 2. Create workflow dependencies
        const deps = await createWorkflowDependencies();

        // 3. Create workflow runner with definition and dependencies
        const runner = new WorkflowRunner(
          definition,
          deps.anthropicClient,
          deps.sessionStorage,
          deps.toolRegistry,
          deps.eventBus
        );
        
        // 4. Run workflow with params (no workflowId needed)
        const params = {
          type: options.type,
          target: options.target ?? 'src/',
          style: options.style,
          update: options.update ?? false,
        };
        
        const result = await runner.run(params);
        console.log(formatResult(result));
        
        process.exit(result.status === 'completed' ? 0 : 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error: ${message}`);
        process.exit(1);
      }
    });
  
  return cmd;
}

/**
 * Create the 'workflows' command to list all available workflows.
 */
function createWorkflowsCommand(): Command {
  const cmd = new Command('workflows');
  
  cmd
    .description('List all available workflows')
    .action(() => {
      try {
        const registry = createRegistry();
        const workflows = registry.list();
        
        console.log('');
        console.log('📋 Available Workflows:');
        console.log('─────────────────────────────────────────');
        console.log('');
        
        workflows.forEach(workflow => {
          console.log(`🔧 ${workflow.id}`);
          console.log(`   Name: ${workflow.name}`);
          console.log(`   Description: ${workflow.description}`);
          console.log('');
        });
        
        console.log(`Total: ${workflows.length} workflows`);
        console.log('');
        
        process.exit(0);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error: ${message}`);
        process.exit(1);
      }
    });
  
  return cmd;
}

/**
 * Create the 'workflow' parent command with 'list' and 'run' subcommands.
 */
function createWorkflowCommand(): Command {
  const cmd = new Command('workflow');
  
  cmd.description('Manage and run workflows');
  
  // Subcommand: workflow list
  const listCmd = new Command('list')
    .description('List all available workflows')
    .action(() => {
      try {
        const registry = createRegistry();
        const workflows = registry.list();
        
        console.log('');
        console.log('📋 Available Workflows:');
        console.log('─────────────────────────────────────────');
        console.log('');
        
        workflows.forEach(workflow => {
          console.log(`🔧 ${workflow.id}`);
          console.log(`   Name: ${workflow.name}`);
          console.log(`   Description: ${workflow.description}`);
          console.log('');
        });
        
        console.log(`Total: ${workflows.length} workflows`);
        console.log('');
        
        process.exit(0);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error: ${message}`);
        process.exit(1);
      }
    });
  
  // Subcommand: workflow run
  const runCmd = new Command('run')
    .description('Run a specific workflow')
    .argument('<workflow-id>', 'ID of the workflow to run')
    .option('--params <json>', 'Workflow parameters as JSON string')
    .action(async (workflowId: string, options: { params?: string }) => {
      try {
        const registry = createRegistry();
        
        // 1. Get workflow definition from registry
        const definition = registry.get(workflowId);
        if (!definition) {
          console.error(`❌ Error: Workflow '${workflowId}' not found`);
          console.error('');
          console.error('Available workflows:');
          const workflows = registry.list();
          workflows.forEach(w => {
            console.error(`  - ${w.id}`);
          });
          process.exit(1);
        }
        
        // 2. Parse params if provided
        let params = {};
        if (options.params) {
          try {
            params = JSON.parse(options.params);
          } catch (error) {
            console.error(`❌ Error: Invalid JSON in --params`);
            process.exit(1);
          }
        }
        
        // 3. Create workflow dependencies
        const deps = await createWorkflowDependencies();

        // 4. Create workflow runner with definition and dependencies
        const runner = new WorkflowRunner(
          definition,
          deps.anthropicClient,
          deps.sessionStorage,
          deps.toolRegistry,
          deps.eventBus
        );
        
        // 5. Run workflow with params (no workflowId needed)
        const result = await runner.run(params);
        console.log(formatResult(result));
        
        process.exit(result.status === 'completed' ? 0 : 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error: ${message}`);
        process.exit(1);
      }
    });
  
  cmd.addCommand(listCmd);
  cmd.addCommand(runCmd);
  
  return cmd;
}

/**
 * Create all workflow-related commands.
 * 
 * @returns Array of Commander.js Command instances
 */
export function createWorkflowCommands(): Command[] {
  return [
    createFixTestsCommand(),
    createReviewCommand(),
    createRefactorCommand(),
    createDocsCommand(),
    createWorkflowsCommand(),
    createWorkflowCommand(), // New nested workflow command
  ];
}
