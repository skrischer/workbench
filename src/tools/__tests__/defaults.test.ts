// src/tools/__tests__/defaults.test.ts — Integration Tests for Default Tools Registry

import { describe, it, expect } from 'vitest';
import { createDefaultTools } from '../defaults.js';

describe('createDefaultTools', () => {
  it('should register all 8 default tools', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    expect(toolNames).toHaveLength(8);
  });

  it('should register all expected tool names', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    const expectedTools = [
      'read_file',
      'write_file',
      'edit_file',
      'exec',
      'list_files',
      'grep',
      'search_code',
      'project_summary',
    ];
    
    for (const toolName of expectedTools) {
      expect(toolNames).toContain(toolName);
    }
  });

  it('should make all tools retrievable via registry.get()', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    for (const name of toolNames) {
      const tool = registry.get(name);
      expect(tool).toBeDefined();
      expect(tool?.name).toBe(name);
    }
  });

  it('should ensure all tools have required properties', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    for (const name of toolNames) {
      const tool = registry.get(name);
      
      expect(tool).toBeDefined();
      expect(tool?.name).toBe(name);
      expect(tool?.description).toBeTruthy();
      expect(typeof tool?.description).toBe('string');
      expect(tool?.inputSchema).toBeDefined();
      expect(typeof tool?.inputSchema).toBe('object');
    }
  });

  it('should register file operation tools', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    const fileOpsTools = ['read_file', 'write_file', 'edit_file'];
    
    for (const toolName of fileOpsTools) {
      expect(toolNames).toContain(toolName);
    }
  });

  it('should register execution tool', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    expect(toolNames).toContain('exec');
  });

  it('should register codebase intelligence tools', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    const codebaseTools = ['list_files', 'grep', 'search_code', 'project_summary'];
    
    for (const toolName of codebaseTools) {
      expect(toolNames).toContain(toolName);
    }
  });
});
