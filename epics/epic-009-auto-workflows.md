# Epic 9: auto-workflows — Test-Fixer, Review, Refactor, Docs Agents

## Ziel
Vorgefertigte autonome Workflows als spezialisierte Agent-Konfigurationen: Test-Fixer repariert kaputte Tests, Code-Reviewer prüft Diffs, Refactor-Agent verbessert Code-Qualität, Docs-Agent generiert/aktualisiert Dokumentation. Jeder Workflow ist ein CLI-Befehl mit vorkonfiguriertem System-Prompt und Tool-Set.

## Abhängigkeiten
- Epic 6 (multi-agent) — Agent-Spawning, Message-Passing
- Epic 8 (git-safety) — Worktrees, Branch-Guards, Auto-Commits

## Tasks

### Task 9.1: `workflow-types` — Workflow-Definition + Registry + Tests

**Beschreibung:** Abstraktion für vordefinierte Workflows: ein Workflow ist eine benannte Agent-Konfiguration mit spezifischem System-Prompt, Tool-Whitelist, und Input-Schema.

**Dateien erstellt/geändert:**
- `src/types/workflow.ts` (WorkflowDefinition, WorkflowInput, WorkflowResult)
- `src/workflows/registry.ts` (WorkflowRegistry: register, get, list)
- `src/workflows/__tests__/registry.test.ts` (mind. 5 Tests)
- `src/workflows/index.ts` (Barrel-Export)

**Type-Definitionen:**
```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  defaultMaxSteps: number;
  inputSchema: {
    required: string[];
    optional: string[];
  };
  validateInput: (input: Record<string, unknown>) => string | null;
}

interface WorkflowInput {
  workflowId: string;
  params: Record<string, unknown>;
  cwd?: string;
  model?: string;
}

interface WorkflowResult {
  workflowId: string;
  status: 'completed' | 'failed' | 'partial';
  output: string;
  filesModified: string[];
  tokenUsage: RunTokenUsage;
  durationMs: number;
}
```

**Acceptance Criteria:**
- WorkflowDefinition vollständig typisiert
- Registry: register, get, list mit ID-basiertem Lookup
- Validierung: ID einzigartig, System-Prompt nicht leer, Tools-Array nicht leer
- Tests: Registration, Lookup, List, Duplikat-Error, Input-Validierung
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S
**Parallelisierbar:** Nein (muss zuerst)

### Task 9.2: `test-fixer` — Test-Fixer Workflow + Tests

**Beschreibung:** Workflow der kaputte Tests analysiert und repariert.

**Dateien erstellt/geändert:**
- `src/workflows/test-fixer.ts` (TestFixerWorkflow: WorkflowDefinition)
- `src/workflows/test-fixer-prompt.ts` (Spezialisierter System-Prompt)
- `src/workflows/__tests__/test-fixer.test.ts` (mind. 5 Tests mit Mocks)

**System-Prompt-Strategie:**
1. `npm run test` ausführen
2. Fehler-Output parsen
3. Test-Dateien + Source lesen
4. Bug im Test oder Source analysieren
5. Source-Fix bevorzugt
6. Verifizieren + Wiederholen

**Input-Schema:** testCommand, testFilter, maxAttempts, preferSourceFix

**Acceptance Criteria:**
- Registriert als `test-fixer`
- Tool-Whitelist: exec, read_file, write_file, edit_file, grep, search_code
- Tests: Definition, Input-Validierung, System-Prompt enthält Strategie
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 9.1, parallel zu 9.3 + 9.4 + 9.5)

### Task 9.3: `code-reviewer` — Code Review Workflow + Tests

**Beschreibung:** Workflow der Git-Diffs reviewt mit strukturiertem Feedback.

**Dateien erstellt/geändert:**
- `src/workflows/code-reviewer.ts` (CodeReviewerWorkflow)
- `src/workflows/code-reviewer-prompt.ts` (Review-System-Prompt)
- `src/workflows/__tests__/code-reviewer.test.ts` (mind. 5 Tests)

**Input-Schema:** branch (required), baseBranch, focus, severity

**Acceptance Criteria:**
- Registriert als `code-reviewer`
- Read-only Tool-Set: read_file, grep, search_code, exec (nur git diff), list_files
- Strukturiertes Markdown-Output mit Severity-Levels (🔴 Critical, 🟡 Suggestions, 🟢 Positive)
- Tests: Definition, Input-Validierung, Tool-Whitelist (kein write_file!)
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 9.1, parallel zu 9.2 + 9.4 + 9.5)

### Task 9.4: `refactor-agent` — Refactoring Workflow + Tests

**Beschreibung:** Workflow für gezielte Refactorings.

**Dateien erstellt/geändert:**
- `src/workflows/refactor-agent.ts` (RefactorWorkflow)
- `src/workflows/refactor-prompt.ts` (Refactor-System-Prompt)
- `src/workflows/__tests__/refactor-agent.test.ts` (mind. 5 Tests)

**Input-Schema:** target (required), type (required: extract-method, rename, move, dead-code, simplify, general), description, dryRun

**Acceptance Criteria:**
- Registriert als `refactor`
- Tools: alle Core + Codebase-Intel Tools
- System-Prompt: Tests nach Refactoring, Funktionalität erhalten
- Dry-Run-Modus
- Tests: Definition, Type-Validierung, Dry-Run-Flag, Tool-Set
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 9.1, parallel zu 9.2 + 9.3 + 9.5)

### Task 9.5: `docs-agent` — Documentation Workflow + Tests

**Beschreibung:** Workflow für Dokumentation.

**Dateien erstellt/geändert:**
- `src/workflows/docs-agent.ts` (DocsWorkflow)
- `src/workflows/docs-prompt.ts` (Docs-System-Prompt)
- `src/workflows/__tests__/docs-agent.test.ts` (mind. 5 Tests)

**Input-Schema:** type (required: readme, jsdoc, api, changelog, general), target, style, update

**Acceptance Criteria:**
- Registriert als `docs`
- Tools: read_file, write_file, edit_file, list_files, search_code, project_summary, exec
- Update-Modus: bestehende Docs respektieren
- Tests: Definition, Type-Validierung, Update-Flag, Tool-Set
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 9.1, parallel zu 9.2 + 9.3 + 9.4)

### Task 9.6: `workflow-cli` — CLI-Befehle + Workflow-Runner + Tests

**Beschreibung:** CLI-Integration aller Workflows.

**Dateien erstellt/geändert:**
- `src/workflows/runner.ts` (WorkflowRunner: run(workflowInput) → WorkflowResult)
- `src/cli/workflow-commands.ts` (CLI-Befehle)
- `src/cli/index.ts` (Commands registrieren)
- `src/cli/__tests__/workflow-commands.test.ts` (mind. 6 Tests)

**CLI-Befehle:**
```
workbench fix-tests [--filter "auth"] [--max-attempts 5]
workbench review <branch> [--focus security]
workbench refactor <target> --type extract-method [--dry-run]
workbench docs --type readme [--target src/tools/] [--update]
```

**Acceptance Criteria:**
- WorkflowRunner: lädt Definition, validiert Input, startet Agent-Run
- CLI-Befehle mapped auf Workflows
- Formatiertes WorkflowResult auf stdout
- Events: `workflow:start`, `workflow:end`
- Tests: Command-Registration, Argument-Mapping, Runner-Lifecycle, Events
- `npx tsc --noEmit` + `npm run build` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Nein (nach 9.2–9.5)

## Parallelisierungs-Plan
```
Wave 1 (sequentiell):
  Task 9.1 (workflow-types)    ──

Wave 2 (parallel, max 4 Worker):
  Task 9.2 (test-fixer)       ──┐
  Task 9.3 (code-reviewer)    ──┤
  Task 9.4 (refactor-agent)   ──┤
  Task 9.5 (docs-agent)       ──┘

Wave 3 (sequentiell):
  Task 9.6 (workflow-cli)     ──
```

## Agent-Bedarf
- **4 Worker** (parallel in Wave 2 — max!)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test`
- Alle 4 Workflows registriert und via CLI aufrufbar
- Event-Map erweitern: `workflow:start`, `workflow:end`

## Offene Fragen / Risiken
- **Workflow-Qualität:** Hängt stark vom System-Prompt ab. Iterative Verbesserung nach ersten Runs.
- **Test-Fixer-Loop:** Agent könnte Tests "fixen" durch Löschen. System-Prompt muss klar sein: Source-Fix bevorzugt.
- **Code-Review Scope:** Bei großen Diffs Chunking-Strategie nötig.
- **Worker-Bedarf Wave 2:** 4 parallele Worker ist Maximum. Bei Ressourcen-Knappheit: auf 2 Waves à 2 splitten.
