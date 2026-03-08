// src/workflows/__tests__/registry.test.ts — Workflow Registry Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowRegistry } from '../registry.js';
import type { WorkflowDefinition } from '../../types/workflow.js';

describe('WorkflowRegistry', () => {
  let registry: WorkflowRegistry;

  // Helper to create a valid workflow definition
  const createWorkflow = (id: string, overrides?: Partial<WorkflowDefinition>): WorkflowDefinition => ({
    id,
    name: `Test Workflow ${id}`,
    description: `Test workflow for ${id}`,
    systemPrompt: 'You are a helpful assistant',
    tools: ['read', 'write'],
    defaultMaxSteps: 10,
    inputSchema: {
      required: ['input'],
      optional: ['cwd'],
    },
    validateInput: (input: Record<string, unknown>): string | null => {
      if (!input.input) {
        return 'Missing required parameter: input';
      }
      return null;
    },
    ...overrides,
  });

  beforeEach(() => {
    registry = new WorkflowRegistry();
  });

  it('should register and retrieve a workflow definition', () => {
    const workflow = createWorkflow('test-workflow');
    
    registry.register(workflow);
    const retrieved = registry.get('test-workflow');
    
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('test-workflow');
    expect(retrieved?.name).toBe('Test Workflow test-workflow');
    expect(retrieved?.systemPrompt).toBe('You are a helpful assistant');
    expect(retrieved?.tools).toEqual(['read', 'write']);
  });

  it('should list all registered workflows', () => {
    const workflow1 = createWorkflow('workflow-1');
    const workflow2 = createWorkflow('workflow-2');
    const workflow3 = createWorkflow('workflow-3');
    
    registry.register(workflow1);
    registry.register(workflow2);
    registry.register(workflow3);
    
    const allWorkflows = registry.list();
    
    expect(allWorkflows).toHaveLength(3);
    expect(allWorkflows.map(w => w.id).sort()).toEqual(['workflow-1', 'workflow-2', 'workflow-3']);
  });

  it('should throw error when registering duplicate workflow ID', () => {
    const workflow1 = createWorkflow('duplicate-id');
    const workflow2 = createWorkflow('duplicate-id');
    
    registry.register(workflow1);
    
    expect(() => {
      registry.register(workflow2);
    }).toThrow('Workflow with id "duplicate-id" is already registered');
  });

  it('should correctly report workflow existence with has()', () => {
    const workflow = createWorkflow('existing-workflow');
    
    expect(registry.has('existing-workflow')).toBe(false);
    
    registry.register(workflow);
    
    expect(registry.has('existing-workflow')).toBe(true);
    expect(registry.has('non-existing-workflow')).toBe(false);
  });

  it('should validate input using WorkflowDefinition.validateInput', () => {
    const workflow = createWorkflow('validation-test');
    registry.register(workflow);
    
    const retrieved = registry.get('validation-test');
    expect(retrieved).toBeDefined();
    
    // Valid input
    const validResult = retrieved!.validateInput({ input: 'test data' });
    expect(validResult).toBeNull();
    
    // Invalid input (missing required parameter)
    const invalidResult = retrieved!.validateInput({});
    expect(invalidResult).toBe('Missing required parameter: input');
  });

  it('should throw error when registering workflow with empty systemPrompt', () => {
    const workflow = createWorkflow('invalid-prompt', { systemPrompt: '' });
    
    expect(() => {
      registry.register(workflow);
    }).toThrow('Workflow "invalid-prompt" must have a non-empty systemPrompt');
    
    const workflow2 = createWorkflow('invalid-prompt-2', { systemPrompt: '   ' });
    
    expect(() => {
      registry.register(workflow2);
    }).toThrow('Workflow "invalid-prompt-2" must have a non-empty systemPrompt');
  });

  it('should throw error when registering workflow with empty tools array', () => {
    const workflow = createWorkflow('no-tools', { tools: [] });
    
    expect(() => {
      registry.register(workflow);
    }).toThrow('Workflow "no-tools" must have at least one tool');
  });

  it('should return undefined for non-existent workflow', () => {
    const retrieved = registry.get('does-not-exist');
    expect(retrieved).toBeUndefined();
  });

  it('should return empty array when no workflows are registered', () => {
    const allWorkflows = registry.list();
    expect(allWorkflows).toEqual([]);
  });
});
