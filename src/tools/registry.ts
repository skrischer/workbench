// src/tools/registry.ts — Tool Registry

import type { BaseTool } from './base.js';

/**
 * Registry for managing tool instances.
 * Prevents duplicate registrations and provides lookup by name.
 */
export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  /**
   * Register a tool in the registry.
   * @param tool - The tool instance to register
   * @throws Error if a tool with the same name is already registered
   */
  register(tool: BaseTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name.
   * @param name - The tool name
   * @returns The tool instance, or undefined if not found
   */
  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool is registered.
   * @param name - The tool name
   * @returns True if the tool exists in the registry
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * List all registered tool names.
   * @returns Array of tool names
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }
}
