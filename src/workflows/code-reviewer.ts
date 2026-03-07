// src/workflows/code-reviewer.ts — Code Reviewer Workflow Definition

import type { WorkflowDefinition } from '../types/workflow.js';
import { CODE_REVIEWER_SYSTEM_PROMPT } from './code-reviewer-prompt.js';

/**
 * Code Reviewer Workflow
 * 
 * Analyzes Git diffs in a read-only manner and provides structured feedback
 * with severity levels (Critical, Suggestions, Positive).
 * 
 * **Input Parameters:**
 * - `branch` (required) — The branch to review
 * - `baseBranch` (optional) — Base branch to compare against (default: main)
 * - `focus` (optional) — Focus area: security, performance, tests, style
 * - `severity` (optional) — Minimum severity level to report: critical, suggestion, all
 */
export const codeReviewerWorkflow: WorkflowDefinition = {
  id: 'code-reviewer',
  name: 'Code Reviewer',
  description: 'Analyzes Git diffs and provides structured code review feedback with severity levels. read-only workflow that reviews changes without modifying files.',
  systemPrompt: CODE_REVIEWER_SYSTEM_PROMPT,
  tools: [
    'read_file',
    'grep',
    'search_code',
    'exec',
    'list_files'
  ],
  defaultMaxSteps: 15,
  inputSchema: {
    required: ['branch'],
    optional: ['baseBranch', 'focus', 'severity']
  },
  validateInput: (input: Record<string, unknown>): string | null => {
    // Check required parameter: branch
    if (!input.branch) {
      return 'Missing required parameter: branch';
    }

    if (typeof input.branch !== 'string') {
      return 'Parameter "branch" must be a string';
    }

    if (input.branch.trim() === '') {
      return 'Parameter "branch" cannot be empty';
    }

    // Validate optional parameters if provided
    if (input.baseBranch !== undefined) {
      if (typeof input.baseBranch !== 'string') {
        return 'Parameter "baseBranch" must be a string';
      }
      if (input.baseBranch.trim() === '') {
        return 'Parameter "baseBranch" cannot be empty';
      }
    }

    if (input.focus !== undefined) {
      if (typeof input.focus !== 'string') {
        return 'Parameter "focus" must be a string';
      }
      const validFocusAreas = ['security', 'performance', 'tests', 'style'];
      if (!validFocusAreas.includes(input.focus)) {
        return `Parameter "focus" must be one of: ${validFocusAreas.join(', ')}`;
      }
    }

    if (input.severity !== undefined) {
      if (typeof input.severity !== 'string') {
        return 'Parameter "severity" must be a string';
      }
      const validSeverities = ['critical', 'suggestion', 'all'];
      if (!validSeverities.includes(input.severity)) {
        return `Parameter "severity" must be one of: ${validSeverities.join(', ')}`;
      }
    }

    return null;
  }
};
