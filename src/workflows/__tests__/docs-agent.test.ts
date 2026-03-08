// src/workflows/__tests__/docs-agent.test.ts — Documentation Workflow Tests

import { describe, it, expect } from 'vitest';
import { docsWorkflow } from '../docs-agent.js';

describe('docsWorkflow', () => {
  it('should have correct workflow ID', () => {
    expect(docsWorkflow.id).toBe('docs');
  });

  it('should contain all expected tools', () => {
    const expectedTools = ['read_file', 'write_file', 'edit_file', 'list_files', 'search_code', 'exec'];
    
    expect(docsWorkflow.tools).toHaveLength(6);
    expect(docsWorkflow.tools).toEqual(expectedTools);
    
    // Verify each tool is present
    expectedTools.forEach(tool => {
      expect(docsWorkflow.tools).toContain(tool);
    });
  });

  it('should return error string when type parameter is missing', () => {
    const result = docsWorkflow.validateInput({});
    
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result).toContain('type');
  });

  it('should return error string when type parameter is invalid', () => {
    const invalidTypes = ['invalid', 'docs', 'documentation', 'README', 123, null];
    
    invalidTypes.forEach(invalidType => {
      const result = docsWorkflow.validateInput({ type: invalidType });
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  it('should return null for valid input with required type parameter', () => {
    const validTypes = ['readme', 'jsdoc', 'api', 'changelog', 'general'];
    
    validTypes.forEach(validType => {
      const result = docsWorkflow.validateInput({ type: validType });
      
      expect(result).toBeNull();
    });
  });

  it('should have proper workflow metadata', () => {
    expect(docsWorkflow.name).toBe('Documentation Agent');
    expect(docsWorkflow.description).toBeTruthy();
    expect(docsWorkflow.description.length).toBeGreaterThan(0);
    expect(docsWorkflow.systemPrompt).toBeTruthy();
    expect(docsWorkflow.systemPrompt.length).toBeGreaterThan(100);
  });

  it('should have correct default max steps', () => {
    expect(docsWorkflow.defaultMaxSteps).toBe(20);
  });

  it('should have correct input schema', () => {
    expect(docsWorkflow.inputSchema.required).toEqual(['type']);
    expect(docsWorkflow.inputSchema.optional).toContain('target');
    expect(docsWorkflow.inputSchema.optional).toContain('style');
    expect(docsWorkflow.inputSchema.optional).toContain('update');
  });

  it('should accept valid input with optional parameters', () => {
    const result = docsWorkflow.validateInput({
      type: 'readme',
      target: 'README.md',
      style: 'detailed',
      update: true,
    });
    
    expect(result).toBeNull();
  });

  it('should reject non-string type parameter', () => {
    const result = docsWorkflow.validateInput({ type: 123 });
    
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
