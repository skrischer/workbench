# Epic 8: git-safety — Git Worktrees, Branch Guards, Rollback

## Ziel
Agent-Operationen durch Git absichern: jeder Run arbeitet in einem isolierten Git Worktree auf einem eigenen Branch. Auto-Commits nach Dateiänderungen, Branch-Guards in Tools, granularer Rollback pro Step. DoD-Enforcement vor Run-Completion und automatisierte PR-Erstellung. Inspiriert vom bewährten dev-pipeline Skill.

## Abhängigkeiten
- Epic 1A (tool-system) — BaseTool-Klasse, write_file/edit_file Tools

## Tasks

### Task 8.1: `git-utils` — Git-Operationen Utility + Tests

**Beschreibung:** Low-Level Git-Utilities als Wrapper um `git` CLI-Befehle.

**Dateien erstellt/geändert:**
- `src/git/git-utils.ts` (GitUtils: createBranch, createWorktree, removeWorktree, commit, diff, getCurrentBranch, isClean, listWorktrees)
- `src/git/__tests__/git-utils.test.ts` (mind. 8 Tests mit temp Git-Repos)
- `src/git/index.ts` (Barrel-Export)

**Acceptance Criteria:**
- `createBranch(name, baseBranch?)` erstellt Branch
- `createWorktree(path, branch)` erstellt Git Worktree
- `removeWorktree(path)` entfernt Worktree + Branch-Cleanup-Option
- `commit(message, cwd?)` staged alle Änderungen + Commit
- `diff(branch1, branch2?, cwd?)` gibt Unified-Diff zurück
- `getCurrentBranch(cwd?)` gibt Branch-Name zurück
- `isClean(cwd?)` prüft Working Directory
- Strukturierte Ergebnisse (kein rohes stdout-Parsing)
- Tests: mit echten temp Git-Repos
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Nein (muss zuerst)

### Task 8.2: `worktree-manager` — Run-isolierte Worktrees + Tests

**Beschreibung:** Worktree-Manager der pro Run einen isolierten Worktree erstellt.

**Dateien erstellt/geändert:**
- `src/git/worktree-manager.ts` (WorktreeManager: createForRun, getWorktreePath, cleanup, listActive)
- `src/git/__tests__/worktree-manager.test.ts` (mind. 6 Tests)
- `src/git/index.ts` (Barrel-Export)

**Branch-Konvention:**
```
agent/run-<run-id>
agent/plan-<plan-id>/step-<n>
```

**Worktree-Verzeichnis:** `~/.workbench/worktrees/<run-id>/`

**Acceptance Criteria:**
- `createForRun(runId, repoPath, baseBranch?)` erstellt Branch + Worktree
- `getWorktreePath(runId)` gibt Pfad zurück
- `cleanup(runId, options?)` entfernt Worktree, optional Branch
- `listActive()` zeigt aktive Worktrees
- Stale-Worktree-Detection (> 24h ohne aktiven Run)
- Tests: Create/Cleanup-Lifecycle, Pfad-Resolution, List, Stale-Detection
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 8.1, parallel zu 8.3)

### Task 8.3: `branch-guards` — Tool-Level Branch-Protection + Tests

**Beschreibung:** Branch-Guards prüfen dass dateiändernde Tools nur auf Agent-Branches arbeiten.

**Dateien erstellt/geändert:**
- `src/git/branch-guard.ts` (BranchGuard: assertOnAgentBranch, isProtectedBranch, wrapTool)
- `src/git/__tests__/branch-guard.test.ts` (mind. 7 Tests)
- `src/git/index.ts` (Barrel-Export)

**Geschützte Branches:** `['main', 'master', 'develop', 'release/*', 'hotfix/*']`

**Acceptance Criteria:**
- `assertOnAgentBranch(cwd)` prüft `agent/` Prefix
- `isProtectedBranch(branch)` matcht gegen Protected-Pattern (inkl. Glob)
- `wrapTool(tool, guard)` gibt guarded Tool zurück
- Nur dateiändernde Tools guarded (write_file, edit_file)
- Bei Violation: ToolResult mit `is_error: true`
- Deaktivierbar via Config
- Tests: Agent-Branch pass, main fail, Patterns, Wrap, Deaktivierung
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 8.1, parallel zu 8.2)

### Task 8.4: `auto-commit` — Automatische Commits + Rollback + Tests

**Beschreibung:** Auto-Commit nach jeder dateiändernden Tool-Execution. Step-Level-Rollback.

**Dateien erstellt/geändert:**
- `src/git/auto-commit.ts` (AutoCommitter: commitAfterTool, getStepCommits, rollbackStep)
- `src/git/__tests__/auto-commit.test.ts` (mind. 6 Tests)
- `src/git/index.ts` (Barrel-Export)

**Commit-Message-Format:**
```
[workbench] <tool_name>: <Beschreibung>

Run: <run-id>
Step: <step-index>
Tool: <tool_name>
Files: <geänderte Dateien>
```

**Acceptance Criteria:**
- `commitAfterTool()` committet wenn Änderungen vorhanden
- Kein Commit wenn clean
- `getStepCommits(runId, stepIndex)` listet Step-Commits
- `rollbackStep(runId, stepIndex)` revertiert Step-Commits
- Commit-Messages parsebar
- Tests: Commit, kein Commit wenn clean, Rollback, Parsing
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Nein (nach 8.2 + 8.3)

### Task 8.5: `runtime-git-integration` — Git-Safety in Runtime Loop + Tests

**Beschreibung:** Alles in den Agent Runtime Loop integrieren.

**Dateien geändert:**
- `src/runtime/agent-loop.ts` (Worktree-Init, Guard-Wrapping, Auto-Commit)
- `src/runtime/create-runtime.ts` (Git-Komponenten in Factory)
- `src/runtime/__tests__/git-integration.test.ts` (mind. 5 Integration-Tests)
- `src/runtime/index.ts` (Barrel-Export)

**Acceptance Criteria:**
- Run mit Git: Worktree erstellt, Tools guarded, Commits passieren
- Run ohne Git: graceful deaktiviert, kein Crash
- Config-Flag: `gitSafety: true/false` (default: true wenn .git existiert)
- `git diff agent/run-<id>..main` zeigt alle Änderungen
- Worktree-Cleanup konfigurierbar (keep/delete)
- Tests: Full-Lifecycle, Graceful-Degradation, Diff nach Run
- `npx tsc --noEmit` + `npm run build` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Nein (nach 8.4)

### Task 8.6: `dod-runner` — Definition-of-Done Enforcement + Tests

**Beschreibung:** DoD-Runner der vor Run-Completion konfigurierbare Checks ausführt (TypeScript-Kompilierung, Build, Tests). Lädt DoD-Commands aus Projekt-Config, führt sie sequentiell im Worktree aus, markiert Run als passed/failed. Inspiriert von `project-task.sh check`.

**Dateien erstellt/geändert:**
- `src/git/dod-runner.ts` (DodRunner: loadConfig, runChecks, getResults)
- `src/git/__tests__/dod-runner.test.ts` (mind. 7 Tests)
- `src/git/index.ts` (Barrel-Export)

**Config-Format** (aus `workbench.json` oder `.workbench.json` im Projekt-Root):
```json
{
  "dod": [
    "npx tsc --noEmit",
    "npm run build",
    "npm run test"
  ],
  "pre_dod": [
    "npm install"
  ]
}
```

**Acceptance Criteria:**
- `loadConfig(cwd)` liest DoD-Commands aus Projekt-Config (`.workbench.json` oder `workbench.json`)
- `runChecks(cwd, config)` führt `pre_dod` dann `dod` Commands sequentiell aus
- Jeder Command: stdout/stderr captured, Exit-Code geprüft
- Bei erstem Fehler: Stop + strukturiertes Ergebnis (welcher Command, Exit-Code, Output)
- Bei Erfolg: alle Commands passed, Summary mit Laufzeiten
- `getResults()` gibt `DodResult` zurück: `{ passed: boolean, checks: CheckResult[], totalDurationMs: number }`
- Kein Config = DoD übersprungen (graceful, Warning geloggt)
- Integration in Runtime: nach letztem Tool-Call, vor Run-Completion
- Tests: Alle Checks pass, erster Check fail (stoppt), kein Config (skip), pre_dod + dod Reihenfolge, Output-Capture, Timing
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Nein (nach 8.5)

### Task 8.7: `pr-workflow` — PR-Erstellung + Review-Status + Tests

**Beschreibung:** Automatisierte PR-Erstellung nach erfolgreichem Run + DoD. Nutzt `gh` CLI für GitHub-Integration. Generiert Diff-Summary als PR-Body, trackt Review-Status. Inspiriert von `project-task.sh pr` + `review-fix`.

**Dateien erstellt/geändert:**
- `src/git/pr-workflow.ts` (PrWorkflow: createPr, getPrStatus, addReviewComment, listOpenPrs)
- `src/git/diff-summary.ts` (DiffSummary: generateSummary — Markdown-formatierte Zusammenfassung der Änderungen)
- `src/git/__tests__/pr-workflow.test.ts` (mind. 7 Tests)
- `src/git/__tests__/diff-summary.test.ts` (mind. 4 Tests)
- `src/git/index.ts` (Barrel-Export)

**PR-Body-Format:**
```markdown
## Changes (auto-generated by workbench)

### Files Modified (5)
- `src/tools/read-file.ts` — Added error handling for binary files
- `src/tools/write-file.ts` — New file: write_file tool implementation
- ...

### Stats
- Lines added: 142
- Lines removed: 23
- DoD: ✅ All checks passed (tsc, build, test)

### Run Info
- Run ID: a1b2c3d4
- Model: claude-sonnet-4-20250514
- Steps: 8
- Duration: 45s
```

**Acceptance Criteria:**
- `createPr(options)` erstellt PR via `gh pr create` mit generiertem Body
- `options`: branch, baseBranch, title, runId, dodResult
- `generateSummary(branch, baseBranch, cwd)` parsed `git diff --stat` + `git log` in Markdown
- `getPrStatus(prNumber)` gibt Review-Status zurück (approved, changes_requested, pending)
- `listOpenPrs(filter?)` listet offene PRs des Repos
- Fehlerbehandlung: `gh` nicht installiert → klarer Error, kein Auth → Hinweis auf `gh auth login`
- PR wird nur erstellt wenn DoD passed (DodRunner-Integration)
- Tests: PR-Create Command-Building, Diff-Summary-Parsing, Status-Mapping, Error-Cases (no gh, no auth), DoD-Gate
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 8.5, parallel zu 8.6 — aber logisch nach DoD)

## Parallelisierungs-Plan
```
Wave 1 (sequentiell):
  Task 8.1 (git-utils)           ──

Wave 2 (parallel):
  Task 8.2 (worktree-manager)    ──┐
  Task 8.3 (branch-guards)       ──┘

Wave 3 (sequentiell):
  Task 8.4 (auto-commit)         ──

Wave 4 (sequentiell):
  Task 8.5 (runtime-integration) ──

Wave 5 (parallel):
  Task 8.6 (dod-runner)          ──┐
  Task 8.7 (pr-workflow)         ──┘
```

## Agent-Bedarf
- **2 Worker** (parallel in Wave 2 + Wave 5)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test`
- Tests mit echten Git-Repos (temp-dir + `git init`)
- DoD-Runner + PR-Workflow funktional und getestet

## Offene Fragen / Risiken
- **Worktree-Performance:** Shallow-Clone/Sparse-Checkout als spätere Optimierung.
- **Parallel-Worktrees:** Multi-Agent (Epic 6) braucht concurrent-safe WorktreeManager.
- **Merge-Strategie:** Agent-Branch → Entwickler reviewed → manueller Merge. Kein Auto-Merge.
- **gh CLI Dependency:** PR-Workflow setzt `gh` voraus. Graceful degradation wenn nicht installiert.
- **DoD-Config-Format:** `.workbench.json` im Projekt-Root. Muss kompatibel sein mit der geplanten Workbench-Projekt-Config (ggf. Subsection von größerer Config).
