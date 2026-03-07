// src/workflows/__tests__/refactor-agent.test.ts — Tests for Refactor Workflow

import { describe, it, expect } from 'vitest';
import { refactorWorkflow } from '../refactor-agent.js';

describe('RefactorWorkflow', () => {
  it('should have correct workflow ID', () => {
    expect(refactorWorkflow.id).toBe('refactor');
  });

  it('should contain all 7 expected tools', () => {
    const expectedTools = [
      'read_file',
      'write_file',
      'edit_file',
      'exec',
      'grep',
      'search_code',
      'list_files',
    ];

    expect(refactorWorkflow.tools).toHaveLength(7);
    expectedTools.forEach((tool) => {
      expect(refactorWorkflow.tools).toContain(tool);
    });
  });

  it('should return error when target parameter is missing', () => {
    const input = { type: 'rename' };
    const result = refactorWorkflow.validateInput(input);

    expect(result).not.toBeNull();
    expect(result).toContain('target');
  });

  it('should return error when type parameter is invalid', () => {
    const input = { target: 'src/file.ts', type: 'invalid-type' };
    const result = refactorWorkflow.validateInput(input);

    expect(result).not.toBeNull();
    expect(result).toContain('type');
    expect(result).toContain('invalid-type');
  });

  it('should return null for valid input', () => {
    const input = {
      target: 'src/file.ts',
      type: 'rename',
    };
    const result = refactorWorkflow.validateInput(input);

    expect(result).toBeNull();
  });

  it('should not error when optional dryRun parameter is missing', () => {
    const input = {
      target: 'src/file.ts',
      type: 'simplify',
    };
    const result = refactorWorkflow.validateInput(input);

    expect(result).toBeNull();
  });

  it('should validate all refactor types as valid', () => {
    const validTypes = [
      'extract-method',
      'rename',
      'move',
      'dead-code',
      'simplify',
      'general',
    ];

    validTypes.forEach((type) => {
      const input = { target: 'src/test.ts', type };
      const result = refactorWorkflow.validateInput(input);
      expect(result).toBeNull();
    });
  });

  it('should return error when target is empty string', () => {
    const input = { target: '   ', type: 'rename' };
    const result = refactorWorkflow.validateInput(input);

    expect(result).not.toBeNull();
    expect(result).toContain('target');
  });
});
