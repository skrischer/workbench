# Epic 4: task-system — Task/Plan/Step Primitives (JSON, deterministisch)

## Ziel
Komplexe Aufgaben in strukturierte, wiederaufnehmbare Pläne zerlegen. Ein Plan besteht aus Steps, jeder Step ist ein atomarer Agent-Aufruf. Alles JSON-basiert, deterministisch, kein DAG — lineare Step-Sequenz mit Status-Tracking.

## Abhängigkeiten
- Epic 1C (runtime-cli) — Agent Runtime Loop existiert
- Epic 2 (observability) — Event Bus, RunLogger, TokenTracker

## Tasks

### Task 4.1: `task-types` — Type-Definitionen + JSON-Schema + Tests

**Beschreibung:** Alle Type-Definitionen für das Task-System: Task, Plan, Step, Status-Enums. JSON-Serialisierbar, deterministische Struktur. Validierungsfunktionen für Plan-JSON.

**Dateien erstellt/geändert:**
- `src/types/task.ts` (Task, Plan, Step, PlanStatus, StepStatus, StepResult Interfaces)
- `src/task/validation.ts` (validatePlan, validateStep — Runtime-Validierung gegen Types)
- `src/task/__tests__/validation.test.ts` (mind. 8 Tests)
- `src/task/index.ts` (Barrel-Export)

**Type-Definitionen:**
```typescript
type PlanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';
type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

interface Step {
  id: string;
  title: string;
  prompt: string;
  status: StepStatus;
  result?: StepResult;
  dependsOn?: string[];
  toolHints?: string[];
  maxSteps?: number;
}

interface StepResult {
  output: string;
  tokenUsage: RunTokenUsage;
  filesModified: string[];
  durationMs: number;
  error?: string;
}

interface Plan {
  id: string;
  title: string;
  description: string;
  status: PlanStatus;
  steps: Step[];
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
  metadata: {
    originalPrompt: string;
    model: string;
    totalTokenUsage?: RunTokenUsage;
  };
}

interface Task {
  id: string;
  prompt: string;
  planId?: string;
  status: PlanStatus;
  createdAt: string;
}
```

**Acceptance Criteria:**
- Alle Types sind exportiert und importierbar
- `validatePlan()` prüft: id, title, mindestens 1 Step, alle Steps haben id+title+prompt
- `validateStep()` prüft: id, title, prompt, gültiger Status
- Validierungsfehler geben klare Fehlermeldungen
- Tests: gültiger Plan, fehlende Felder, leere Steps, ungültiger Status, Step-Validierung, Edge Cases
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S
**Parallelisierbar:** Nein (muss zuerst — Types für alle anderen Tasks)

### Task 4.2: `plan-storage` — Plan-Persistenz als JSON + Tests

**Beschreibung:** Pläne als JSON-Dateien persistieren. CRUD-Operationen, atomisches Schreiben, Status-Updates.

**Dateien erstellt/geändert:**
- `src/task/plan-storage.ts` (PlanStorage: create, load, save, list, updateStepStatus, delete)
- `src/task/__tests__/plan-storage.test.ts` (mind. 7 Tests mit temp-dir)
- `src/task/index.ts` (Barrel-Export)

**Datei-Struktur:**
```
~/.workbench/plans/
  <plan-id>/
    plan.json
```

**Acceptance Criteria:**
- `create(plan)` validiert und speichert als JSON
- `load(id)` liest und validiert von Disk
- `save(plan)` atomisch (write-to-temp + rename)
- `updateStepStatus(planId, stepId, status, result?)` — granulares Update
- `list()` gibt Plan-IDs + Metadata (ohne Steps) zurück
- `delete(id)` löscht Plan-Verzeichnis
- Tests: CRUD-Roundtrip, Status-Update, List, Delete, nicht-existierender Plan
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S
**Parallelisierbar:** Ja (nach 4.1, parallel zu 4.3)

### Task 4.3: `plan-generator` — LLM-basierte Plan-Generierung + Tests

**Beschreibung:** Einen Prompt an den LLM schicken mit der Anweisung, einen strukturierten Plan als JSON zu generieren. System-Prompt mit Plan-Schema, Parsing und Validierung der LLM-Antwort.

**Dateien erstellt/geändert:**
- `src/task/plan-generator.ts` (PlanGenerator: generate(prompt, config) → Plan)
- `src/task/plan-prompt.ts` (System-Prompt-Template für Plan-Generierung)
- `src/task/__tests__/plan-generator.test.ts` (mind. 5 Tests mit Mock-LLM)
- `src/task/index.ts` (Barrel-Export)

**Acceptance Criteria:**
- `generate(prompt)` sendet Prompt + Schema-Anweisung an LLM
- LLM-Response wird als JSON geparst (Fallback: JSON aus Markdown-Code-Block extrahieren)
- Generierter Plan wird validiert (`validatePlan()`)
- Bei Parse-/Validierungsfehler: 1 Retry mit Fehlermeldung an LLM
- Plan bekommt UUID, Status `pending`, currentStepIndex 0
- Tests: erfolgreiche Generierung (Mock), JSON-Extraktion aus Markdown, Validierungsfehler + Retry, Parse-Fehler
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 4.1, parallel zu 4.2)

### Task 4.4: `plan-executor` — Step-für-Step-Ausführung + Tests

**Beschreibung:** Den Plan Step-für-Step durch den Agent Runtime Loop ausführen. Jeder Step ist ein eigener Agent-Run. Status-Tracking, Pause/Resume, Fehlerbehandlung.

**Dateien erstellt/geändert:**
- `src/task/plan-executor.ts` (PlanExecutor: execute(planId), resume(planId), pause(planId))
- `src/task/__tests__/plan-executor.test.ts` (mind. 8 Tests mit Mocks)
- `src/task/index.ts` (Barrel-Export)

**Execution-Logik:**
```
1. Plan laden
2. Plan-Status → 'running'
3. FOR step von currentStepIndex bis Ende:
   a. Step-Status → 'running', Plan speichern
   b. Agent Runtime Loop mit step.prompt ausführen
   c. StepResult extrahieren (output, tokenUsage, filesModified, durationMs)
   d. Step-Status → 'completed', Result anhängen
   e. currentStepIndex++, Plan speichern
   f. IF paused: Status → 'paused', break
   g. IF step failed:
      - Step-Status → 'failed', error setzen
      - Plan-Status → 'failed', break
4. Wenn alle Steps completed: Plan-Status → 'completed'
5. totalTokenUsage berechnen und in Plan-Metadata speichern
```

**Acceptance Criteria:**
- Lineare Ausführung: Step 1 → Step 2 → ... → Step N
- Plan wird nach jedem Step persistiert (Crash-Recovery)
- `resume(planId)` setzt bei `currentStepIndex` fort
- `pause()` setzt Flag, Executor bricht nach aktuellem Step ab
- Bei Step-Fehler: Plan-Status `failed`, fehlerhafte Step-Info erhalten
- Events emitted: `plan:start`, `plan:step:start`, `plan:step:end`, `plan:end`
- Tests: Vollständige Ausführung (Mock), Resume nach Pause, Fehler-Handling, Event-Emission, Token-Akkumulation
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** L
**Parallelisierbar:** Nein (nach 4.2 + 4.3)

### Task 4.5: `cli-plan-commands` — CLI-Befehle für Plan-Workflow + Tests

**Beschreibung:** CLI-Befehle für das Task-System: `workbench plan`, `workbench run-plan`, `workbench plans`.

**Dateien erstellt/geändert:**
- `src/cli/plan-command.ts` (`workbench plan "<prompt>"` — generiert Plan, zeigt Preview)
- `src/cli/run-plan-command.ts` (`workbench run-plan <plan-id>` — führt Plan aus)
- `src/cli/plans-command.ts` (`workbench plans` — listet Pläne)
- `src/cli/index.ts` (neue Commands registrieren)
- `src/cli/__tests__/plan-commands.test.ts` (mind. 5 Tests)

**CLI-Befehle:**
```
workbench plan "add authentication"     # Generiert Plan, zeigt Preview
workbench plan "..." --auto-run         # Generiert und führt sofort aus
workbench run-plan <plan-id>            # Führt existierenden Plan aus
workbench run-plan <plan-id> --resume   # Setzt pausierten Plan fort
workbench plans                         # Listet alle Pläne
workbench plans --status running        # Filtert nach Status
```

**Acceptance Criteria:**
- `plan` generiert Plan, zeigt Steps mit Status als formatierte Tabelle
- `run-plan` startet Execution, zeigt Fortschritt (Step X/N)
- `plans` listet Pläne mit ID, Titel, Status, Step-Count
- `--auto-run` Flag kombiniert Generierung und Ausführung
- `--resume` Flag für pausierte Pläne
- Tests: Command-Registration, Argument-Parsing, Output-Formatierung
- `npx tsc --noEmit` + `npm run build` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Nein (nach 4.4)

## Parallelisierungs-Plan
```
Wave 1 (sequentiell):
  Task 4.1 (task-types + validation) ──

Wave 2 (parallel):
  Task 4.2 (plan-storage)     ──┐
  Task 4.3 (plan-generator)   ──┘

Wave 3 (sequentiell):
  Task 4.4 (plan-executor)    ──

Wave 4 (sequentiell):
  Task 4.5 (cli-plan-commands) ──
```

## Agent-Bedarf
- **2 Worker** (parallel in Wave 2)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test`
- Event-Map in `src/types/events.ts` um Plan-Events erweitern (`plan:start`, `plan:step:start`, `plan:step:end`, `plan:end`)

## Offene Fragen / Risiken
- **Step-Kontext:** Jeder Step bekommt Plan-Kontext als System-Message-Prefix, damit der Agent weiß wo er im Plan steht. Details in Task 4.4.
- **Plan-Qualität:** Hängt vom LLM ab. Schema im System-Prompt muss gut sein. Iterative Verbesserung.
- **Step-Granularität:** LLM-Guidance nötig ("3-10 Steps für typische Tasks").
- **Kein DAG:** Bewusste Entscheidung. Linear = deterministisch = debuggbar. Parallel-Steps kommen mit Multi-Agent (Epic 6).
