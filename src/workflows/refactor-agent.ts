// src/workflows/refactor-agent.ts — Refactoring Workflow Definition

import type { WorkflowDefinition } from '../types/workflow.js';
import { REFACTOR_SYSTEM_PROMPT } from './refactor-prompt.js';

const VALID_REFACTOR_TYPES = [
  'extract-method',
  'rename',
  'move',
  'dead-code',
  'simplify',
  'general',
] as const;

export const refactorWorkflow: WorkflowDefinition = {
  id: 'refactor',
  name: 'Refactor Agent',
  description:
    'Performs targeted code refactoring: extract methods, rename symbols, move code, remove dead code, simplify logic, or apply general improvements. Ensures tests pass after changes.',
  systemPrompt: REFACTOR_SYSTEM_PROMPT,
  tools: [
    'read_file',
    'write_file',
    'edit_file',
    'exec',
    'grep',
    'search_code',
    'list_files',
  ],
  defaultMaxSteps: 25,
  inputSchema: {
    required: ['target', 'type'],
    optional: ['description', 'dryRun'],
  },
  validateInput: (input: Record<string, unknown>): string | null => {
    // Validate target exists and is non-empty string
    if (!input.target || typeof input.target !== 'string' || input.target.trim() === '') {
      return 'Parameter "target" is required and must be a non-empty string';
    }

    // Validate type exists and is one of the valid types
    if (!input.type || typeof input.type !== 'string') {
      return 'Parameter "type" is required and must be a string';
    }

    if (!VALID_REFACTOR_TYPES.includes(input.type as any)) {
      return `Parameter "type" must be one of: ${VALID_REFACTOR_TYPES.join(', ')}. Got: "${input.type}"`;
    }

    // Optional parameters don't need validation (description, dryRun)
    // They can be missing or any type

    return null; // Validation passed
  },
};
