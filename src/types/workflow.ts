// src/types/workflow.ts — Workflow Type Definitions

import type { RunTokenUsage } from './tokens.js';

/**
 * Workflow definition that specifies how to execute a workflow.
 * Contains metadata, configuration, and validation logic.
 */
export interface WorkflowDefinition {
  /** Unique identifier for the workflow */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the workflow does */
  description: string;
  /** System prompt for the agent executing this workflow */
  systemPrompt: string;
  /** List of tool names available to this workflow */
  tools: string[];
  /** Default maximum steps for execution */
  defaultMaxSteps: number;
  /** Input schema definition */
  inputSchema: {
    /** Required parameter names */
    required: string[];
    /** Optional parameter names */
    optional: string[];
  };
  /**
   * Validate input parameters.
   * @param input - Input parameters to validate
   * @returns Error message if validation fails, null if valid
   */
  validateInput: (input: Record<string, unknown>) => string | null;
}

/**
 * Input for executing a workflow.
 */
export interface WorkflowInput {
  /** ID of the workflow to execute */
  workflowId: string;
  /** Parameters for the workflow */
  params: Record<string, unknown>;
  /** Working directory (optional) */
  cwd?: string;
  /** Model to use (optional, uses workflow default if not specified) */
  model?: string;
}

/**
 * Result of a workflow execution.
 */
export interface WorkflowResult {
  /** ID of the workflow that was executed */
  workflowId: string;
  /** Execution status */
  status: 'completed' | 'failed' | 'partial';
  /** Final output/result text */
  output: string;
  /** List of files modified during execution */
  filesModified: string[];
  /** Token usage statistics */
  tokenUsage: RunTokenUsage;
  /** Execution duration in milliseconds */
  durationMs: number;
}

/**
 * Condition for conditional workflow execution in chains.
 * All conditions are JSON-serializable (declarative rules).
 */
export interface WorkflowCondition {
  /** Match on workflow status */
  status?: 'completed' | 'failed';
  /** Match on token usage (less-than/greater-than) */
  tokenUsage?: {
    $lt?: number;
    $gt?: number;
  };
  /** Match if output contains this string */
  outputContains?: string;
}

/**
 * A single step in a workflow chain.
 */
export interface ChainStep {
  /** ID of the workflow to execute */
  workflowId: string;
  /** Parameters to pass to the workflow */
  params: Record<string, unknown>;
  /** Optional condition to determine if this step should run */
  condition?: WorkflowCondition;
}

/**
 * Definition of a workflow chain.
 * A chain executes workflows sequentially, passing output from one to the next.
 */
export interface ChainDefinition {
  /** Array of workflow steps to execute in sequence */
  steps: ChainStep[];
}

/**
 * Result of a single step in a workflow chain.
 */
export interface ChainStepResult {
  /** ID of the workflow that was executed */
  workflowId: string;
  /** Execution status */
  status: 'completed' | 'failed' | 'skipped';
  /** Final output/result text (empty if skipped) */
  output: string;
  /** Token usage statistics */
  tokenUsage: RunTokenUsage;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Reason for skipping (if status is 'skipped') */
  skipReason?: string;
}

/**
 * Result of a workflow chain execution.
 */
export interface ChainResult {
  /** Overall chain status */
  status: 'completed' | 'failed' | 'partial';
  /** Results from each step (in order) */
  steps: ChainStepResult[];
  /** Total token usage across all steps */
  totalTokenUsage: RunTokenUsage;
  /** Total execution duration in milliseconds */
  totalDurationMs: number;
}
