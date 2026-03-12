// src/tools/registry.ts — Tool Registry

import type { BaseTool } from './base.js';

/**
 * Registry for managing tool instances.
 * Prevents duplicate registrations and provides lookup by name.
 * Supports aliases for alternative tool names (e.g., 'read' → 'read_file').
 */
export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();
  private aliases: Map<string, string> = new Map();

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
   * Register an alias for a tool.
   * @param alias - The alias name
   * @param canonical - The canonical tool name
   * @throws Error if the canonical tool doesn't exist
   * @throws Error if the alias collides with an existing tool name
   */
  registerAlias(alias: string, canonical: string): void {
    if (!this.tools.has(canonical)) {
      throw new Error(`Cannot create alias "${alias}": canonical tool "${canonical}" does not exist`);
    }
    if (this.tools.has(alias)) {
      throw new Error(`Cannot create alias "${alias}": a tool with that name already exists`);
    }
    this.aliases.set(alias, canonical);
  }

  /**
   * Get a tool by name or alias.
   * @param name - The tool name or alias
   * @returns The tool instance, or undefined if not found
   */
  get(name: string): BaseTool | undefined {
    // Try direct lookup first
    const direct = this.tools.get(name);
    if (direct) {
      return direct;
    }
    
    // Try alias lookup
    const canonical = this.aliases.get(name);
    if (canonical) {
      return this.tools.get(canonical);
    }
    
    return undefined;
  }

  /**
   * Check if a tool is registered (by name or alias).
   * @param name - The tool name or alias
   * @returns True if the tool exists in the registry
   */
  has(name: string): boolean {
    return this.tools.has(name) || this.aliases.has(name);
  }

  /**
   * List all registered tool names (canonical only, no aliases).
   * @returns Array of canonical tool names
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * List all tools with their aliases.
   * @returns Array of objects with canonical name and aliases
   */
  listWithAliases(): { name: string; aliases: string[] }[] {
    const result: { name: string; aliases: string[] }[] = [];
    
    for (const name of this.tools.keys()) {
      const aliases: string[] = [];
      for (const [alias, canonical] of this.aliases.entries()) {
        if (canonical === name) {
          aliases.push(alias);
        }
      }
      result.push({ name, aliases });
    }
    
    return result;
  }
}
