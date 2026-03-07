// src/cli/__tests__/workflow-commands.test.ts — Tests for Workflow Commands

import { describe, it, expect } from 'vitest';
import { createWorkflowCommands } from '../workflow-commands.js';
import { WorkflowRegistry } from '../../workflows/registry.js';
import { WorkflowRunner } from '../../workflows/runner.js';
import { testFixerWorkflow } from '../../workflows/test-fixer.js';
import { codeReviewerWorkflow } from '../../workflows/code-reviewer.js';
import { refactorWorkflow } from '../../workflows/refactor-agent.js';
import { docsWorkflow } from '../../workflows/docs-agent.js';

describe('createWorkflowCommands', () => {
  it('should return an array with 5 commands', () => {
    const commands = createWorkflowCommands();
    
    expect(commands).toBeInstanceOf(Array);
    expect(commands.length).toBe(5);
    
    // Verify command names
    const commandNames = commands.map(cmd => cmd.name());
    expect(commandNames).toContain('fix-tests');
    expect(commandNames).toContain('review');
    expect(commandNames).toContain('refactor');
    expect(commandNames).toContain('docs');
    expect(commandNames).toContain('workflows');
  });
  
  it('fix-tests command should have correct options', () => {
    const commands = createWorkflowCommands();
    const fixTestsCmd = commands.find(cmd => cmd.name() === 'fix-tests');
    
    expect(fixTestsCmd).toBeDefined();
    
    // Check options
    const options = fixTestsCmd!.options;
    const optionNames = options.map(opt => opt.long);
    
    expect(optionNames).toContain('--filter');
    expect(optionNames).toContain('--max-attempts');
    
    // Verify option details
    const filterOption = options.find(opt => opt.long === '--filter');
    expect(filterOption?.description).toBeDefined();
    
    const maxAttemptsOption = options.find(opt => opt.long === '--max-attempts');
    expect(maxAttemptsOption?.description).toBeDefined();
  });
  
  it('review command should have required argument <branch>', () => {
    const commands = createWorkflowCommands();
    const reviewCmd = commands.find(cmd => cmd.name() === 'review');
    
    expect(reviewCmd).toBeDefined();
    
    // Check that it has at least one argument
    const args = reviewCmd!.registeredArguments;
    expect(args.length).toBeGreaterThan(0);
    
    // First argument should be required
    const branchArg = args[0];
    expect(branchArg.required).toBe(true);
    expect(branchArg.name()).toBe('branch');
  });
  
  it('refactor command should have required argument <target> and --type option', () => {
    const commands = createWorkflowCommands();
    const refactorCmd = commands.find(cmd => cmd.name() === 'refactor');
    
    expect(refactorCmd).toBeDefined();
    
    // Check required argument
    const args = refactorCmd!.registeredArguments;
    expect(args.length).toBeGreaterThan(0);
    
    const targetArg = args[0];
    expect(targetArg.required).toBe(true);
    expect(targetArg.name()).toBe('target');
    
    // Check --type option
    const options = refactorCmd!.options;
    const typeOption = options.find(opt => opt.long === '--type');
    
    expect(typeOption).toBeDefined();
    expect(typeOption?.required).toBe(true);
  });
  
  it('docs command should have --type option', () => {
    const commands = createWorkflowCommands();
    const docsCmd = commands.find(cmd => cmd.name() === 'docs');
    
    expect(docsCmd).toBeDefined();
    
    // Check --type option
    const options = docsCmd!.options;
    const typeOption = options.find(opt => opt.long === '--type');
    
    expect(typeOption).toBeDefined();
    expect(typeOption?.required).toBe(true);
  });
});

describe('WorkflowRunner', () => {
  it('should throw error for unknown workflow', async () => {
    const registry = new WorkflowRegistry();
    const runner = new WorkflowRunner(registry);
    
    await expect(
      runner.run({
        workflowId: 'non-existent-workflow',
        params: {},
      })
    ).rejects.toThrow('Workflow not found: non-existent-workflow');
  });
  
  it('should throw error for invalid input', async () => {
    const registry = new WorkflowRegistry();
    registry.register(testFixerWorkflow);
    
    const runner = new WorkflowRunner(registry);
    
    // testFixerWorkflow requires 'testCommand' parameter
    await expect(
      runner.run({
        workflowId: 'test-fixer',
        params: {}, // Missing required testCommand
      })
    ).rejects.toThrow('Invalid input');
  });
  
  it('should list all 4 workflows', () => {
    const registry = new WorkflowRegistry();
    registry.register(testFixerWorkflow);
    registry.register(codeReviewerWorkflow);
    registry.register(refactorWorkflow);
    registry.register(docsWorkflow);
    
    const runner = new WorkflowRunner(registry);
    const workflows = runner.listWorkflows();
    
    expect(workflows.length).toBe(4);
    
    // Verify workflow IDs
    const workflowIds = workflows.map(w => w.id);
    expect(workflowIds).toContain('test-fixer');
    expect(workflowIds).toContain('code-reviewer');
    expect(workflowIds).toContain('refactor');
    expect(workflowIds).toContain('docs');
    
    // Verify structure
    workflows.forEach(workflow => {
      expect(workflow).toHaveProperty('id');
      expect(workflow).toHaveProperty('name');
      expect(workflow).toHaveProperty('description');
      expect(typeof workflow.id).toBe('string');
      expect(typeof workflow.name).toBe('string');
      expect(typeof workflow.description).toBe('string');
    });
  });
});
