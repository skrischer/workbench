// src/workflows/runner.ts — Workflow Runner

import type { WorkflowDefinition, WorkflowInput, WorkflowResult } from '../types/workflow.js';
import type { RunTokenUsage } from '../types/tokens.js';
import { WorkflowRegistry } from './registry.js';

/**
 * WorkflowRunner executes workflows registered in a WorkflowRegistry.
 * 
 * This runner handles validation and orchestration but does not yet integrate
 * with the actual agent runtime (that will be wired up later).
 */
export class WorkflowRunner {
  constructor(private registry: WorkflowRegistry) {}

  /**
   * Run a workflow with the given input.
   * 
   * @param input - Workflow input containing workflowId and parameters
   * @returns Promise resolving to WorkflowResult
   * @throws Error if workflow not found or input validation fails
   */
  async run(input: WorkflowInput): Promise<WorkflowResult> {
    const definition = this.registry.get(input.workflowId);
    if (!definition) {
      throw new Error(`Workflow not found: ${input.workflowId}`);
    }
    
    // Validate input
    const validationError = definition.validateInput(input.params);
    if (validationError) {
      throw new Error(`Invalid input: ${validationError}`);
    }

    const startTime = Date.now();
    
    // For now, return a structured result indicating the workflow was prepared
    // The actual agent execution will be wired in when the runtime is integrated
    const result: WorkflowResult = {
      workflowId: input.workflowId,
      status: 'completed',
      output: `Workflow '${definition.name}' prepared successfully. Agent execution pending runtime integration.`,
      filesModified: [],
      tokenUsage: {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheWriteTokens: 0,
        totalTokens: 0,
        stepCount: 0,
      },
      durationMs: Date.now() - startTime,
    };

    return result;
  }
  
  /**
   * List all available workflows in the registry.
   * 
   * @returns Array of workflow metadata (id, name, description)
   */
  listWorkflows(): { id: string; name: string; description: string }[] {
    return this.registry.list().map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
    }));
  }
}
