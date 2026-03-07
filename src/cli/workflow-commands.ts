// src/cli/workflow-commands.ts — Workflow CLI Commands

import { Command } from 'commander';
import { WorkflowRegistry } from '../workflows/registry.js';
import { WorkflowRunner } from '../workflows/runner.js';
import { testFixerWorkflow } from '../workflows/test-fixer.js';
import { codeReviewerWorkflow } from '../workflows/code-reviewer.js';
import { refactorWorkflow } from '../workflows/refactor-agent.js';
import { docsWorkflow } from '../workflows/docs-agent.js';
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
        const registry = createRegistry();
        const runner = new WorkflowRunner(registry);
        
        const input: WorkflowInput = {
          workflowId: 'test-fixer',
          params: {
            testCommand: 'npm test',
            testFilter: options.filter,
            maxAttempts: options.maxAttempts ?? 5,
          },
        };
        
        const result = await runner.run(input);
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
        const registry = createRegistry();
        const runner = new WorkflowRunner(registry);
        
        const input: WorkflowInput = {
          workflowId: 'code-reviewer',
          params: {
            branch,
            baseBranch: options.base ?? 'main',
            focus: options.focus,
          },
        };
        
        const result = await runner.run(input);
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
        const registry = createRegistry();
        const runner = new WorkflowRunner(registry);
        
        const input: WorkflowInput = {
          workflowId: 'refactor',
          params: {
            target,
            type: options.type,
            dryRun: options.dryRun ?? false,
            description: options.description,
          },
        };
        
        const result = await runner.run(input);
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
        const registry = createRegistry();
        const runner = new WorkflowRunner(registry);
        
        const input: WorkflowInput = {
          workflowId: 'docs',
          params: {
            type: options.type,
            target: options.target ?? 'src/',
            style: options.style,
            update: options.update ?? false,
          },
        };
        
        const result = await runner.run(input);
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
        const runner = new WorkflowRunner(registry);
        
        const workflows = runner.listWorkflows();
        
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
  ];
}
