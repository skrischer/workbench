// src/workflows/docs-agent.ts — Documentation Workflow Definition

import type { WorkflowDefinition } from '../types/workflow.js';
import { DOCS_SYSTEM_PROMPT } from './docs-prompt.js';

const VALID_DOC_TYPES = ['readme', 'jsdoc', 'api', 'changelog', 'general'] as const;

/**
 * Documentation Agent Workflow
 * 
 * Analyzes code and generates documentation based on the specified type.
 * Supports creating new documentation or updating existing docs.
 */
export const docsWorkflow: WorkflowDefinition = {
  id: 'docs',
  name: 'Documentation Agent',
  description:
    'Analyzes codebases and generates high-quality documentation. ' +
    'Supports README files, JSDoc comments, API references, changelogs, and general guides. ' +
    'Can create new documentation or update existing docs while preserving style and structure.',
  systemPrompt: DOCS_SYSTEM_PROMPT,
  tools: ['read_file', 'write_file', 'edit_file', 'list_files', 'search_code', 'exec'],
  defaultMaxSteps: 20,
  inputSchema: {
    required: ['type'],
    optional: ['target', 'style', 'update'],
  },
  validateInput: (input: Record<string, unknown>): string | null => {
    // Check if 'type' parameter exists
    if (!input.type) {
      return 'Missing required parameter: "type". Must be one of: readme, jsdoc, api, changelog, general';
    }

    // Check if 'type' is a string
    if (typeof input.type !== 'string') {
      return 'Parameter "type" must be a string';
    }

    // Check if 'type' is one of the valid values
    if (!VALID_DOC_TYPES.includes(input.type as any)) {
      return `Invalid documentation type: "${input.type}". Must be one of: ${VALID_DOC_TYPES.join(', ')}`;
    }

    // All validation passed
    return null;
  },
};
