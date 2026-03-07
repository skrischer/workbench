// src/tools/defaults.ts — Factory for Default Tools

import { ToolRegistry } from './registry.js';
import { ReadFileTool } from './read-file.js';
import { WriteFileTool } from './write-file.js';
import { EditFileTool } from './edit-file.js';
import { ExecTool } from './exec.js';
import { ListFilesTool } from './list-files.js';
import { GrepTool } from './grep.js';
import { SearchCodeTool } from './search-code.js';
import { ProjectSummaryTool } from './project-summary.js';

/**
 * Creates a ToolRegistry with all default core tools registered.
 * @returns ToolRegistry with all 8 default tools (file ops, exec, codebase intelligence)
 */
export function createDefaultTools(): ToolRegistry {
  const registry = new ToolRegistry();
  
  // File operation tools
  registry.register(new ReadFileTool());
  registry.register(new WriteFileTool());
  registry.register(new EditFileTool());
  
  // Execution tool
  registry.register(new ExecTool());
  
  // Codebase intelligence tools
  registry.register(new ListFilesTool());
  registry.register(new GrepTool());
  registry.register(new SearchCodeTool());
  registry.register(new ProjectSummaryTool());
  
  return registry;
}
