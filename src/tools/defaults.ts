// src/tools/defaults.ts — Factory for Default Tools

import { ToolRegistry } from './registry.js';
import { ReadFileTool } from './read-file.js';
import { WriteFileTool } from './write-file.js';
import { EditFileTool } from './edit-file.js';
import { ExecTool } from './exec.js';

/**
 * Creates a ToolRegistry with all default core tools registered.
 * @returns ToolRegistry with ReadFileTool, WriteFileTool, EditFileTool, and ExecTool
 */
export function createDefaultTools(): ToolRegistry {
  const registry = new ToolRegistry();
  
  registry.register(new ReadFileTool());
  registry.register(new WriteFileTool());
  registry.register(new EditFileTool());
  registry.register(new ExecTool());
  
  return registry;
}
