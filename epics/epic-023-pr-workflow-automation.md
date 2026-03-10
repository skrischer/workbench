# Epic 23: pr-workflow-automation — Automatische PR-Erstellung nach Agent-Runs

## Ziel
Schließt den Git-Safety Dev-Workflow: Agent erstellt Code in isoliertem Worktree, führt DoD-Checks durch und erstellt **automatisch einen Pull Request** via GitHub CLI (`gh`). Developer reviewed und mergt, ohne manuell PR-Details zusammenzustellen.

**Problem:** Aktuell endet Agent-Run nach DoD-Pass, Developer muss manuell:
- `git diff` prüfen
- `gh pr create` ausführen
- PR-Body mit Metrics/Diff-Summary schreiben

**Lösung:** Automatisierte PR-Erstellung mit strukturiertem Template (Diff-Summary, Token-Usage, Tool-History).

## Abhängigkeiten
- Epic 8 (git-safety) — Worktree-Manager + DoD-Runner vorhanden ✅
- Epic 2 (observability) — Run Logger vorhanden ✅
- GitHub CLI (`gh`) installiert + authentifiziert (Runtime-Requirement)

## Tasks

### Task 23.1: `pr-creator` — PR-Creation Logic

**Beschreibung:**
Core-Modul für automatische PR-Erstellung via GitHub CLI. Nutzt `gh pr create` mit strukturiertem Template.

**Dateien erstellt/geändert:**
- `src/git/pr-creator.ts` (Main PR-Creation Logic)
- `src/git/pr-template.ts` (Template-Generator für PR-Body)
- `src/types/index.ts` (PROptions Interface)

**Interface:**
```typescript
interface PROptions {
  branch: string;           // z.B. "agent/fix-auth-bug"
  baseBranch: string;       // z.B. "develop"
  title: string;            // Auto-generated oder manuell
  body: string;             // Generated via pr-template.ts
  labels?: string[];        // z.B. ["agent-created", "enhancement"]
  reviewers?: string[];     // z.B. ["gonz"]
  draft?: boolean;          // Default: false
}

interface PRResult {
  url: string;              // https://github.com/owner/repo/pull/123
  number: number;           // 123
  status: 'created' | 'error';
  error?: string;
}

export async function createPR(options: PROptions): Promise<PRResult>;
```

**Implementation:**
- Nutzt `exec()` Tool für `gh pr create`
- Error-Handling für:
  - `gh` nicht installiert
  - Nicht authentifiziert (`gh auth status`)
  - Branch existiert nicht auf Remote
  - PR bereits vorhanden
- Validierung: Branch darf nicht `main` oder `develop` sein (Safety)

**Acceptance Criteria:**
- `createPR()` erstellt PR via GitHub CLI
- Fehlerbehandlung für alle Edge-Cases (gh missing, not authenticated, etc.)
- Validierung: Branch muss `agent/*` oder `feature/*` sein
- Returniert PR-URL + Number
- TypeScript kompiliert
- Unit Tests für Input-Validation
- Integration Test: Mock `gh pr create` Execution

**Komplexität:** M  
**Parallelisierbar:** Nein (Basis für 23.2)

---

### Task 23.2: `pr-template` — PR-Body-Generator

**Beschreibung:**
Generiert strukturierten Markdown-Body für PR basierend auf Run-Metadata, Diff-Summary und Tool-History.

**Dateien erstellt/geändert:**
- `src/git/pr-template.ts` (Template-Generator)
- `src/git/diff-summary.ts` (Git-Diff-Parser + Summarizer)

**Template-Struktur:**
```markdown
## Summary
{task description or commit message summary}

## Changes
{diff summary: files changed, additions, deletions}

**Modified Files:**
- `src/auth/token-storage.ts` (+47 -12 lines)
- `src/types/index.ts` (+8 -0 lines)
- `tests/auth.test.ts` (+23 -0 lines)

## Agent Metrics
- **Token Usage:** 8,234 input / 3,127 output (11,361 total)
- **Model:** anthropic/claude-sonnet-4
- **Steps:** 12
- **Duration:** 4m 23s
- **Tools Used:** read_file (5x), write_file (3x), edit_file (2x), exec (4x)

## DoD Status
✅ TypeScript compilation passed
✅ Production build passed
✅ Unit tests passed (902/902)
✅ E2E tests passed (63/63)

## Files Modified
- src/auth/token-storage.ts
- src/types/index.ts
- tests/auth.test.ts

---
*This PR was automatically created by Workbench Agent. Run ID: `d655302a-ded9-4ec2-839d-fa5a022aab68`*
```

**Interface:**
```typescript
interface PRTemplateInput {
  taskDescription: string;
  diffSummary: DiffSummary;
  runMetadata: RunMetadata;
  dodResults: DODResult[];
  filesModified: string[];
}

interface DiffSummary {
  filesChanged: number;
  insertions: number;
  deletions: number;
  fileDetails: Array<{
    path: string;
    insertions: number;
    deletions: number;
  }>;
}

export function generatePRBody(input: PRTemplateInput): string;
export function generatePRTitle(taskDescription: string): string;
```

**Diff-Summary Implementation:**
- Nutzt `git diff --stat` für Gesamtstatistik
- Nutzt `git diff --numstat` für pro-File-Details
- Begrenzt auf Top 10 Files (bei vielen Änderungen)

**Acceptance Criteria:**
- `generatePRBody()` erstellt strukturierten Markdown
- `generatePRTitle()` extrahiert kurzen Titel aus Task-Description
- Diff-Summary zeigt Files + Lines Changed
- Token-Usage + Tool-History eingebettet
- DoD-Status visualisiert (✅/❌)
- Footer mit Run-ID für Traceability
- TypeScript kompiliert
- Unit Tests für Template-Generierung
- Unit Tests für Diff-Parsing

**Komplexität:** M  
**Parallelisierbar:** Ja (parallel zu 23.1, aber braucht 23.1 für Integration)

---

### Task 23.3: `workflow-integration` — Integration in Agent-Loop

**Beschreibung:**
Integriert PR-Creation in bestehende Workflows (run-plan, fix-tests, review, refactor, docs). PR wird automatisch erstellt nach DoD-Pass, außer `--no-pr` Flag gesetzt.

**Dateien erstellt/geändert:**
- `src/runtime/agent-loop.ts` (Post-Run Hook für PR-Creation)
- `src/cli/run-plan-command.ts` (--no-pr Flag hinzufügen)
- `src/cli/workflow-commands.ts` (--no-pr Flag für alle Workflows)
- `src/config/user-config.ts` (autoCreatePR Setting)

**CLI-Interface:**
```bash
# Default: PR wird automatisch erstellt
workbench run plan-<id>

# Explizit deaktivieren:
workbench run plan-<id> --no-pr
workbench fix-tests --no-pr
workbench review <branch> --no-pr

# Persistent deaktivieren via Config:
workbench config set autoCreatePR false
```

**Integration-Flow:**
1. Agent-Run endet erfolgreich
2. DoD-Check läuft durch ✅
3. Check UserConfig: `autoCreatePR` (default: true)
4. Check CLI-Flag: `--no-pr` (overrides config)
5. Wenn PR erlaubt:
   - Diff-Summary generieren
   - Run-Metadata sammeln
   - PR-Body generieren
   - `createPR()` aufrufen
   - PR-URL loggen + in Run-Metadata speichern

**Run-Metadata Extension:**
```typescript
interface RunMetadata {
  // ... existing fields
  prUrl?: string;         // GitHub PR URL falls erstellt
  prNumber?: number;      // PR Number
}
```

**Acceptance Criteria:**
- PR wird automatisch erstellt nach DoD-Pass (wenn nicht explizit deaktiviert)
- `--no-pr` Flag unterdrückt PR-Creation
- `autoCreatePR` Config-Setting respektiert
- PR-URL wird in Run-Metadata gespeichert
- CLI zeigt PR-URL nach Erstellung
- Fehlerbehandlung: Wenn `gh` fehlt → Warning statt Failure
- TypeScript kompiliert
- Unit Tests für Integration-Logic
- E2E Test: `workbench run plan-<id>` erstellt PR

**Komplexität:** L  
**Parallelisierbar:** Nein (braucht 23.1 + 23.2)

---

### Task 23.4: `pr-config` — Config & Defaults

**Beschreibung:**
Erweitert UserConfig um PR-spezifische Settings (Default-Reviewers, Labels, Draft-Mode).

**Dateien erstellt/geändert:**
- `src/config/user-config.ts` (PR-Config Fields hinzufügen)
- `src/types/index.ts` (UserConfig Interface erweitern)
- `src/git/pr-creator.ts` (Config-Integration)

**Config-Schema:**
```typescript
interface UserConfig {
  // ... existing fields
  autoCreatePR?: boolean;           // Default: true
  defaultReviewers?: string[];      // z.B. ["gonz", "alice"]
  prLabels?: string[];              // z.B. ["agent-created"]
  prDraft?: boolean;                // Default: false
  prBaseBranch?: string;            // Default: "develop"
}
```

**CLI-Integration:**
```bash
workbench config set defaultReviewers gonz,alice
workbench config set prLabels agent-created,enhancement
workbench config set prDraft true
workbench config set autoCreatePR false
```

**Acceptance Criteria:**
- UserConfig enthält PR-spezifische Fields
- Config-Validation für Listen (Reviewers, Labels)
- `pr-creator.ts` nutzt Config-Defaults
- CLI-Flags überschreiben Config-Defaults
- TypeScript kompiliert
- Unit Tests für Config-Validation
- E2E Test: `workbench config set defaultReviewers ...` wirkt sich auf PR aus

**Komplexität:** S  
**Parallelisierbar:** Ja (parallel zu 23.1-23.3)

---

## Parallelisierungs-Plan

```
Wave 1 (sequentiell):
  Task 23.1 (pr-creator)           ──

Wave 2 (parallel):
  Task 23.2 (pr-template)          ──┐
  Task 23.4 (pr-config)            ──┘

Wave 3 (sequentiell):
  Task 23.3 (workflow-integration) ──
```

## Agent-Bedarf
- **2 Worker (max parallel in Wave 2)** für parallele Tasks
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` für alle Module
- `npm run build` erfolgreich
- `npm test` — Unit Tests grün (mindestens 1 Test pro Modul)
- `npm run test:e2e` — E2E Test: PR-Creation end-to-end
- GitHub CLI (`gh`) als Runtime-Dependency dokumentieren
- README.md aktualisieren (PR-Workflow dokumentieren)
- CHANGELOG.md aktualisieren

## Offene Fragen / Risiken
- **GitHub CLI Availability:** Was passiert wenn `gh` nicht installiert ist? **→ Entscheidung: Warning statt Error, PR-Creation optional, DoD bleibt grün**
- **PR-Template Customization:** User will vielleicht eigenes Template? **→ Zukünftige Feature, vorerst festes Template**
- **Multi-Repo Support:** Was wenn Agent in anderem Repo als Workbench arbeitet? **→ PR-Creator nutzt `gh` in jeweiligem Git-Worktree, funktioniert automatisch**
- **PR bereits vorhanden:** Was wenn Branch schon einen PR hat? **→ `gh pr create` gibt Error → Catch + Warning statt Failure**
