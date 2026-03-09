// src/runtime/core-agent-loop.ts — Deprecated Re-Export
// @deprecated Use AgentLoop from './agent-loop.js' instead. CoreAgentLoop is now a legacy alias.

import { AgentLoop } from './agent-loop.js';

/**
 * @deprecated Use AgentLoop instead. CoreAgentLoop is maintained for backward compatibility.
 * 
 * CoreAgentLoop was the original pure LLM loop implementation.
 * It has been merged into AgentLoop, which now supports optional lifecycle hooks.
 * 
 * Migration guide:
 * ```typescript
 * // Old:
 * const loop = new CoreAgentLoop(client, storage, registry, config, eventBus);
 * 
 * // New (same behavior):
 * const loop = new AgentLoop(client, storage, registry, config, eventBus);
 * 
 * // With Git hooks:
 * import { createGitHooks } from './git-hooks.js';
 * const hooks = createGitHooks({ repoPath: '/path/to/repo' });
 * const loop = new AgentLoop(client, storage, registry, config, eventBus, hooks);
 * ```
 */
export { AgentLoop as CoreAgentLoop };
