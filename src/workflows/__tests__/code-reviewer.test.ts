// src/workflows/__tests__/code-reviewer.test.ts — Code Reviewer Workflow Tests

import { describe, it, expect } from 'vitest';
import { codeReviewerWorkflow } from '../code-reviewer.js';

describe('Code Reviewer Workflow', () => {
  it('should have correct workflow ID', () => {
    expect(codeReviewerWorkflow.id).toBe('code-reviewer');
  });

  it('should not include write_file or edit_file in tool whitelist', () => {
    const tools = codeReviewerWorkflow.tools;
    expect(tools).not.toContain('write_file');
    expect(tools).not.toContain('edit_file');
  });

  it('should include all 5 read-only tools', () => {
    const tools = codeReviewerWorkflow.tools;
    expect(tools).toContain('read_file');
    expect(tools).toContain('grep');
    expect(tools).toContain('search_code');
    expect(tools).toContain('exec');
    expect(tools).toContain('list_files');
    expect(tools).toHaveLength(5);
  });

  it('should reject input with missing branch parameter', () => {
    const result = codeReviewerWorkflow.validateInput({});
    expect(result).toBe('Missing required parameter: branch');
  });

  it('should accept valid input with required branch parameter', () => {
    const result = codeReviewerWorkflow.validateInput({ branch: 'feature/new-feature' });
    expect(result).toBeNull();
  });

  it('should reject input with empty branch string', () => {
    const result = codeReviewerWorkflow.validateInput({ branch: '   ' });
    expect(result).toBe('Parameter "branch" cannot be empty');
  });

  it('should reject input with non-string branch parameter', () => {
    const result = codeReviewerWorkflow.validateInput({ branch: 123 });
    expect(result).toBe('Parameter "branch" must be a string');
  });

  it('should accept valid input with all optional parameters', () => {
    const result = codeReviewerWorkflow.validateInput({
      branch: 'feature/test',
      baseBranch: 'main',
      focus: 'security',
      severity: 'critical'
    });
    expect(result).toBeNull();
  });

  it('should reject invalid focus parameter', () => {
    const result = codeReviewerWorkflow.validateInput({
      branch: 'feature/test',
      focus: 'invalid-focus'
    });
    expect(result).toBe('Parameter "focus" must be one of: security, performance, tests, style');
  });

  it('should reject invalid severity parameter', () => {
    const result = codeReviewerWorkflow.validateInput({
      branch: 'feature/test',
      severity: 'low'
    });
    expect(result).toBe('Parameter "severity" must be one of: critical, suggestion, all');
  });

  it('should have non-empty systemPrompt', () => {
    expect(codeReviewerWorkflow.systemPrompt).toBeTruthy();
    expect(codeReviewerWorkflow.systemPrompt.trim().length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(codeReviewerWorkflow.name).toBe('Code Reviewer');
    expect(codeReviewerWorkflow.description).toContain('read-only');
    expect(codeReviewerWorkflow.defaultMaxSteps).toBe(15);
  });

  it('should have correct input schema structure', () => {
    expect(codeReviewerWorkflow.inputSchema.required).toEqual(['branch']);
    expect(codeReviewerWorkflow.inputSchema.optional).toContain('baseBranch');
    expect(codeReviewerWorkflow.inputSchema.optional).toContain('focus');
    expect(codeReviewerWorkflow.inputSchema.optional).toContain('severity');
  });

  it('should reject empty baseBranch when provided', () => {
    const result = codeReviewerWorkflow.validateInput({
      branch: 'feature/test',
      baseBranch: ''
    });
    expect(result).toBe('Parameter "baseBranch" cannot be empty');
  });

  it('should reject non-string baseBranch', () => {
    const result = codeReviewerWorkflow.validateInput({
      branch: 'feature/test',
      baseBranch: null
    });
    expect(result).toBe('Parameter "baseBranch" must be a string');
  });
});
