// src/workflows/test-fixer.ts — Test Fixer Workflow Definition

import type { WorkflowDefinition } from '../types/workflow.js';
import { TEST_FIXER_SYSTEM_PROMPT } from './test-fixer-prompt.js';

/**
 * Test Fixer Workflow — analyzes and repairs failing tests.
 * 
 * This workflow runs test commands, parses failures, reads source and test files,
 * identifies root causes, and fixes bugs (preferring source fixes over test modifications).
 */
export const testFixerWorkflow: WorkflowDefinition = {
  id: 'test-fixer',
  name: 'Test Fixer',
  description: 'Analyzes failing tests and fixes them by addressing root causes in source code or test logic',
  systemPrompt: TEST_FIXER_SYSTEM_PROMPT,
  tools: ['exec', 'read_file', 'write_file', 'edit_file', 'grep', 'search_code'],
  defaultMaxSteps: 20,
  inputSchema: {
    required: ['testCommand'],
    optional: ['testFilter', 'maxAttempts', 'preferSourceFix'],
  },
  validateInput: (input: Record<string, unknown>): string | null => {
    // Check required: testCommand
    if (!input.testCommand || typeof input.testCommand !== 'string') {
      return 'testCommand is required and must be a non-empty string';
    }

    if (input.testCommand.trim() === '') {
      return 'testCommand must be a non-empty string';
    }

    // Optional parameters don't need strict validation, but we can add basic type checks
    if (input.testFilter !== undefined && typeof input.testFilter !== 'string') {
      return 'testFilter must be a string';
    }

    if (input.maxAttempts !== undefined && typeof input.maxAttempts !== 'number') {
      return 'maxAttempts must be a number';
    }

    if (input.preferSourceFix !== undefined && typeof input.preferSourceFix !== 'boolean') {
      return 'preferSourceFix must be a boolean';
    }

    return null;
  },
};
