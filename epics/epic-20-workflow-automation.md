# Epic 20: workflow-automation — Workflow Chaining & Scheduling

## Ziel
Workflows von einzelnen Ad-hoc-Runs zu automatisierbaren, verkettbaren Abläufen erweitern. Zwei Features: Workflow Chaining (Output von Workflow A als Input für Workflow B) und ein einfacher Scheduler (Workflows periodisch oder auf Events ausführen). Voraussetzung: Epic 17 Task 17.3 (Workflow Runner Integration) muss fertig sein.

## Abhängigkeiten
- Epic 17 (DX & Runtime) — Task 17.3: Workflow Runner muss echte Runs ausführen können
- Epic 9 (Auto Workflows) — Workflow-Registry, Workflow-Definitionen
- Epic 2 (Observability) — Event Bus für Event-Triggered Workflows

## Tasks

### Task 20.1: `workflow-chaining` — Workflows verketten

**Beschreibung:** Ein Workflow-Chain definiert eine Sequenz von Workflows. Output des vorherigen Workflows wird als Context an den nächsten übergeben. Use Case: `fix-tests → review → docs` — Tests fixen, dann reviewen, dann Docs aktualisieren.

**Dateien erstellt/geändert:**
- `src/workflows/chain.ts` (neu — WorkflowChain Klasse)
- `src/types/workflow.ts` (ChainDefinition, ChainResult Types)
- `src/workflows/__tests__/chain.test.ts` (neu)
- `src/cli/workflow-commands.ts` (chain-Subcommand)

**Acceptance Criteria:**
- `WorkflowChain` akzeptiert Array von `{ workflowId, params, condition? }`
- Sequentielle Ausführung: Workflow N wartet auf Workflow N-1
- Output-Forwarding: `previousResult.output` als `context` Parameter verfügbar
- Conditional Steps: `condition: (previousResult) => boolean` — überspringt Step wenn false
- Bei Fehler: Chain stoppt, gibt Partial-Result zurück (welche Steps liefen, welche nicht)
- `workflow:chain:start` und `workflow:chain:end` Events
- CLI: `workbench workflow chain fix-tests,review,docs --cwd .`
- Mindestens 8 Tests: Happy Path, Error-Stop, Conditional Skip, Output-Forwarding, Event-Emission
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M  
**Parallelisierbar:** Nein — vor 20.2

### Task 20.2: `workflow-scheduler` — Einfacher Workflow-Scheduler

**Beschreibung:** Workflows zeitgesteuert oder Event-getriggert ausführen. v1: Cron-ähnliche Syntax für periodische Ausführung, Event-Listener für reaktive Workflows.

**Dateien erstellt/geändert:**
- `src/workflows/scheduler.ts` (neu — WorkflowScheduler Klasse)
- `src/workflows/__tests__/scheduler.test.ts` (neu)
- `src/cli/workflow-commands.ts` (schedule-Subcommand)
- `src/types/workflow.ts` (ScheduleConfig Type)

**Acceptance Criteria:**
- `WorkflowScheduler` akzeptiert Schedule-Config:
  - `cron: "0 */6 * * *"` (alle 6 Stunden) — nutzt `cron-parser` oder einfaches Interval-Matching
  - `onEvent: "run:end"` (Event-Trigger) — Workflow startet wenn Event emitted wird
- Scheduler läuft als Background-Task im Dashboard-Server
- `workbench workflow schedule fix-tests --cron "0 8 * * *"` — täglich um 8:00
- `workbench workflow schedule review --on-event "run:end"` — nach jedem Run
- `workbench workflow schedules` — aktive Schedules anzeigen
- `workbench workflow unschedule <id>` — Schedule entfernen
- Schedule-Persistenz in JSON (überlebt Server-Restart)
- Mindestens 10 Tests: Cron-Parsing, Event-Trigger, Schedule CRUD, Persistence
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** L  
**Parallelisierbar:** Nein — nach 20.1 (nutzt Chain-Infrastruktur optional)

## Parallelisierungs-Plan

```
Wave 1 (sequentiell):
  Task 20.1 (workflow-chaining)     ──

Wave 2 (sequentiell, nach 20.1):
  Task 20.2 (workflow-scheduler)    ──
```

## Agent-Bedarf
- **1 Worker** (sequentiell)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test` + `npm run test:e2e`
- Mindestens 18 neue Tests (8 + 10)
- Workflows können verkettet und geplant werden
- CLI-Commands funktionieren
- Bestehende Tests bleiben grün

## Offene Fragen / Risiken
- **Scheduler Lifecycle:** Scheduler läuft im Dashboard-Server-Prozess. Wenn der Server stoppt, stoppen auch die Schedules. Persistenz stellt sicher dass sie nach Restart wieder aktiviert werden.
- **Cron-Library:** `cron-parser` als Dependency oder eigenes Interval-Matching? Empfehlung: `cron-parser` (bewährt, klein, kein Runtime-Overhead).
- **Event-Loop-Blocking:** Workflows die 10+ Minuten laufen könnten den Scheduler blockieren. Mitigation: Async Execution, maxConcurrent-Limit.
- **Epic 17 Dependency:** Dieses Epic ist BLOCKIERT bis Task 17.3 (Workflow Runner Integration) fertig ist. Ohne echten Runner gibt es nichts zu chainen oder schedulen.
