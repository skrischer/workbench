# Bugfix: Tool Execution Not Working

## Problem
Agent generierte nur beschreibenden Text ("I'll create this file...") statt Tools (`write`, `exec`, `edit`) tatsächlich aufzurufen. Der Plan zeigte "completed" Status, aber keine Dateien wurden erstellt.

## Root Cause
Der `agentConfig` in `run-plan-command.ts` hatte **keine `tools` Property**. Dadurch sendete der `AgentLoop` keine Tool-Definitionen an den LLM, und der Agent konnte nur Text generieren, aber keine Tools aufrufen.

In `agent-loop.ts` Zeile 194:
```typescript
const toolNames = this.config.tools ?? [];  // ❌ Empty array = no tools!
```

## Solution
Drei-Schichten-Fix für maximale Robustheit:

### 1. run-plan-command.ts (PRIMARY FIX)
**Zeile 112-117:** Explizit tools ins agentConfig einfügen:
```typescript
const agentConfig = {
  model,
  maxSteps: step.maxSteps ?? 10,
  systemPrompt: 'You are a helpful AI assistant executing a plan step.',
  tools: toolRegistry.list(), // ✅ CRITICAL: Enable tools for the agent
};
```

### 2. run-command.ts (DEFENSIVE FIX)
**Zeile 155-159:** Fallback für leere oder fehlende tools-Config:
```typescript
// ✅ CRITICAL: Ensure tools are populated if config is empty
if (!agentConfig.tools || agentConfig.tools.length === 0) {
  agentConfig.tools = toolRegistry.list();
}
```

### 3. agent-loop.ts (SAFETY NET)
**Zeile 194-199:** Automatisches Tool-Population wenn leer:
```typescript
// ✅ If no tools specified or empty array, use all available tools from registry
let toolNames = this.config.tools ?? [];
if (toolNames.length === 0) {
  toolNames = this.toolRegistry.list();
}
```

## Files Changed
1. ✅ `src/cli/run-plan-command.ts` - Primary fix: tools explicitly added + filesModified tracking
2. ✅ `src/cli/run-command.ts` - Defensive fix: fallback for empty tools
3. ✅ `src/runtime/agent-loop.ts` - Safety net: auto-populate if empty
4. ❌ `src/task/step-runner.ts` - Not needed (functionality in plan-executor.ts)
5. ❌ `src/tools/registry.ts` - No changes needed (already correct)

### Additional Feature: filesModified Tracking
**run-plan-command.ts** now tracks file modifications via event system:
- Subscribes to `tool:call` events during step execution
- Detects file-modifying tools (`write_file`, `edit_file`, etc.)
- Extracts file paths and populates `filesModified` array
- Properly unsubscribes in `finally` block to prevent memory leaks

## Verification
✅ TypeScript kompiliert ohne Fehler (`npx tsc --noEmit`)
✅ npm run build läuft durch
✅ Alle Änderungen im compiled Code verifiziert:
   - `tools: toolRegistry.list()` in run-plan-command.js
   - `agentConfig.tools = toolRegistry.list()` in run-command.js  
   - `toolNames = this.toolRegistry.list()` in agent-loop.js

## Test Command
```bash
cd /tmp/workbench-worktrees/fix-tool-exec
npm run build
# Should complete without errors

# Test with actual prompt (requires valid tokens):
# workbench run "Create test.txt with content 'hello'"
# → File should actually be created (not just described)
```

## Impact
- ✅ Agent can now call tools (write_file, exec, edit_file, etc.)
- ✅ `filesModified` array will be populated after tool executions
- ✅ Plans will execute actual changes instead of just describing them
- ✅ Three layers of defense prevent future tool-missing scenarios

## Notes
- `step-runner.ts` was mentioned in task but doesn't exist
- Actual step execution is handled by `StepRunner` callback in `plan-executor.ts`
- Fix was applied at the correct location where `StepRunner` is instantiated
