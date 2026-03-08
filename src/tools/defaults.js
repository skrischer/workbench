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
import { RememberTool } from './remember.js';
import { RecallTool } from './recall.js';
import { SpawnAgentTool } from './spawn-agent.js';
import { SendMessageTool } from './send-message.js';
import { ListAgentsTool } from './list-agents.js';
/**
 * Creates a ToolRegistry with all default core tools registered.
 * @param options - Optional configuration for tools
 * @returns ToolRegistry with all default tools (file ops, exec, codebase intelligence, memory if store provided, multi-agent if registry/bus provided)
 */
export function createDefaultTools(options) {
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
    // Memory tools (optional, only if store is provided)
    if (options?.memoryStore) {
        registry.register(new RememberTool(options.memoryStore));
        registry.register(new RecallTool(options.memoryStore));
    }
    // Multi-agent tools (optional, only if registry and bus are provided)
    if (options?.agentRegistry) {
        registry.register(new SpawnAgentTool(options.agentRegistry));
        registry.register(new ListAgentsTool(options.agentRegistry));
    }
    if (options?.messageBus) {
        registry.register(new SendMessageTool(options.messageBus));
    }
    return registry;
}
