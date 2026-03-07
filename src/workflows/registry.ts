// src/workflows/registry.ts — Workflow Registry

import type { WorkflowDefinition } from '../types/workflow.js';

/**
 * Registry for managing workflow definitions.
 * Prevents duplicate registrations and provides lookup by ID.
 */
export class WorkflowRegistry {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  /**
   * Register a workflow definition in the registry.
   * @param definition - The workflow definition to register
   * @throws Error if validation fails or a workflow with the same ID is already registered
   */
  register(definition: WorkflowDefinition): void {
    // Validate workflow ID is not already registered
    if (this.workflows.has(definition.id)) {
      throw new Error(`Workflow with id "${definition.id}" is already registered`);
    }

    // Validate systemPrompt is not empty
    if (!definition.systemPrompt || definition.systemPrompt.trim() === '') {
      throw new Error(`Workflow "${definition.id}" must have a non-empty systemPrompt`);
    }

    // Validate tools array is not empty
    if (!definition.tools || definition.tools.length === 0) {
      throw new Error(`Workflow "${definition.id}" must have at least one tool`);
    }

    this.workflows.set(definition.id, definition);
  }

  /**
   * Get a workflow definition by ID.
   * @param id - The workflow ID
   * @returns The workflow definition, or undefined if not found
   */
  get(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  /**
   * Check if a workflow is registered.
   * @param id - The workflow ID
   * @returns True if the workflow exists in the registry
   */
  has(id: string): boolean {
    return this.workflows.has(id);
  }

  /**
   * List all registered workflow definitions.
   * @returns Array of workflow definitions
   */
  list(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }
}
