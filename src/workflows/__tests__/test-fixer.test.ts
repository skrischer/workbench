// src/workflows/__tests__/test-fixer.test.ts — Tests for Test Fixer Workflow

import { describe, it, expect } from 'vitest';
import { testFixerWorkflow } from '../test-fixer.js';
import { TEST_FIXER_SYSTEM_PROMPT } from '../test-fixer-prompt.js';

describe('testFixerWorkflow', () => {
  it('has correct workflow ID "test-fixer"', () => {
    expect(testFixerWorkflow.id).toBe('test-fixer');
  });

  it('tool whitelist contains all 6 expected tools', () => {
    const expectedTools = ['exec', 'read_file', 'write_file', 'edit_file', 'grep', 'search_code'];
    expect(testFixerWorkflow.tools).toEqual(expectedTools);
    expect(testFixerWorkflow.tools).toHaveLength(6);
  });

  it('input validation fails when testCommand is missing', () => {
    const result = testFixerWorkflow.validateInput({});
    expect(result).toMatch(/testCommand.*required/i);
  });

  it('input validation passes with valid testCommand', () => {
    const result = testFixerWorkflow.validateInput({
      testCommand: 'npm run test',
    });
    expect(result).toBeNull();
  });

  it('system prompt contains test-fixing strategy keywords', () => {
    // Check that the prompt includes key strategic terms
    const prompt = TEST_FIXER_SYSTEM_PROMPT.toLowerCase();
    
    expect(prompt).toContain('test');
    expect(prompt).toContain('fix');
    expect(prompt).toContain('source');
    
    // Additional strategy keywords to ensure comprehensive guidance
    expect(prompt).toContain('analyze');
    expect(prompt).toContain('verify');
  });
});
