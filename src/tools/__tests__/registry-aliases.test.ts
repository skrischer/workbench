// src/tools/__tests__/registry-aliases.test.ts — Tool Registry Alias Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../registry.js';
import { BaseTool } from '../base.js';
import type { ToolResult } from '../../types/index.js';

/**
 * Mock tool for testing
 */
class MockTool extends BaseTool {
  readonly name: string;
  readonly description = 'Mock tool for testing';
  readonly inputSchema = { type: 'object', properties: {} };

  constructor(name: string) {
    super();
    this.name = name;
  }

  async execute(): Promise<ToolResult> {
    return { success: true, output: 'mock output' };
  }
}

describe('ToolRegistry Aliases', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should register an alias for an existing tool', () => {
    // Arrange
    const tool = new MockTool('read_file');
    registry.register(tool);

    // Act
    registry.registerAlias('read', 'read_file');

    // Assert
    expect(registry.has('read')).toBe(true);
  });

  it('should resolve alias to canonical tool via get()', () => {
    // Arrange
    const tool = new MockTool('read_file');
    registry.register(tool);
    registry.registerAlias('read', 'read_file');

    // Act
    const resolved = registry.get('read');

    // Assert
    expect(resolved).toBe(tool);
    expect(resolved?.name).toBe('read_file');
  });

  it('should throw error when alias points to non-existent tool', () => {
    // Act & Assert
    expect(() => {
      registry.registerAlias('read', 'non_existent_tool');
    }).toThrow('Cannot create alias "read": canonical tool "non_existent_tool" does not exist');
  });

  it('should throw error when alias collides with existing tool name', () => {
    // Arrange
    const tool1 = new MockTool('read_file');
    const tool2 = new MockTool('read');
    registry.register(tool1);
    registry.register(tool2);

    // Act & Assert
    expect(() => {
      registry.registerAlias('read', 'read_file');
    }).toThrow('Cannot create alias "read": a tool with that name already exists');
  });

  it('should list() return only canonical names (no aliases)', () => {
    // Arrange
    const tool1 = new MockTool('read_file');
    const tool2 = new MockTool('write_file');
    registry.register(tool1);
    registry.register(tool2);
    registry.registerAlias('read', 'read_file');
    registry.registerAlias('write', 'write_file');

    // Act
    const names = registry.list();

    // Assert
    expect(names).toHaveLength(2);
    expect(names).toContain('read_file');
    expect(names).toContain('write_file');
    expect(names).not.toContain('read');
    expect(names).not.toContain('write');
  });

  it('should listWithAliases() return canonical names with their aliases', () => {
    // Arrange
    const tool1 = new MockTool('read_file');
    const tool2 = new MockTool('write_file');
    const tool3 = new MockTool('exec');
    registry.register(tool1);
    registry.register(tool2);
    registry.register(tool3);
    registry.registerAlias('read', 'read_file');
    registry.registerAlias('write', 'write_file');
    registry.registerAlias('run', 'exec');

    // Act
    const result = registry.listWithAliases();

    // Assert
    expect(result).toHaveLength(3);
    
    const readFile = result.find(item => item.name === 'read_file');
    expect(readFile).toBeDefined();
    expect(readFile?.aliases).toContain('read');
    
    const writeFile = result.find(item => item.name === 'write_file');
    expect(writeFile).toBeDefined();
    expect(writeFile?.aliases).toContain('write');
    
    const execTool = result.find(item => item.name === 'exec');
    expect(execTool).toBeDefined();
    expect(execTool?.aliases).toContain('run');
  });

  it('should support multiple aliases for the same tool', () => {
    // Arrange
    const tool = new MockTool('read_file');
    registry.register(tool);
    registry.registerAlias('read', 'read_file');
    registry.registerAlias('r', 'read_file');
    registry.registerAlias('rf', 'read_file');

    // Act
    const result = registry.listWithAliases();
    const readFile = result.find(item => item.name === 'read_file');

    // Assert
    expect(readFile?.aliases).toHaveLength(3);
    expect(readFile?.aliases).toContain('read');
    expect(readFile?.aliases).toContain('r');
    expect(readFile?.aliases).toContain('rf');
    
    // All aliases should resolve to the same tool
    expect(registry.get('read')).toBe(tool);
    expect(registry.get('r')).toBe(tool);
    expect(registry.get('rf')).toBe(tool);
  });

  it('should return undefined for non-existent tool name or alias', () => {
    // Arrange
    const tool = new MockTool('read_file');
    registry.register(tool);
    registry.registerAlias('read', 'read_file');

    // Act & Assert
    expect(registry.get('non_existent')).toBeUndefined();
    expect(registry.get('write')).toBeUndefined();
  });
});
