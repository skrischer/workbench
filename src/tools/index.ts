// src/tools/index.ts — Tool Exports

export { BaseTool } from './base.js';
export { ToolRegistry } from './registry.js';
export { ReadFileTool } from './read-file.js';
export { WriteFileTool } from './write-file.js';
export { EditFileTool } from './edit-file.js';
export { ExecTool } from './exec.js';
export { ListFilesTool } from './list-files.js';
export { GrepTool } from './grep.js';
export { SearchCodeTool } from './search-code.js';
export { ProjectSummaryTool } from './project-summary.js';
export { createDefaultTools } from './defaults.js';

// Validation
export { validateToolInput } from './validator.js';
export type { ValidationResult } from './validator.js';

// Utility exports
export { defaultIgnores, shouldIgnore, walkDirectory } from './utils/ignore.js';
export type { WalkOptions, WalkEntry } from './utils/ignore.js';
