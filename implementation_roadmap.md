# Workbench — Implementation Roadmap

> Ein AI-gestütztes Entwicklungswerkzeug als CLI-Tool. Single-User, Self-Hosted auf VPS mit Tailscale-Zugang.

## Überblick

Workbench ist ein lokales AI Dev OS: ein Agent-System, das Code lesen, schreiben, ausführen und iterativ verbessern kann — gesteuert über eine CLI (`workbench`). Die Architektur ist event-driven, der Storage JSON-basiert (mit SQLite-Migrationspfad), die Runtime Node.js 22+ (siehe `tech_stack.md`).

Die Implementierung gliedert sich in **10 Phasen (0–9)**, organisiert in **13 Epics**. Phasen mit unabhängigen Abhängigkeiten können parallel entwickelt werden.

---

## Phase 0 — Project Bootstrap

**Ziel:** Projekt-Grundgerüst mit Build-Pipeline, Typen und Entwicklungsinfrastruktur.

**Epic: `0-bootstrap`**

| Komponente | Details |
|---|---|
| Projekt-Scaffold | TypeScript, ESM, Vitest, Commander.js |
| Verzeichnisstruktur | `src/{tools,runtime,llm,cli,types,storage}/` |
| Shared Types | Interfaces: `Agent`, `Tool`, `Session`, `Run`, `Task`, `Plan`, `Step` |
| Dev-Pipeline | `.openclaw-dev.json` für Integration (siehe `dev-pipeline.md`) |
| Branch-Setup | `develop` Branch erstellen |

**Abhängigkeiten:** Keine — Startpunkt.

**Erfolgskriterium:** Projekt kompiliert, Tests laufen, Verzeichnisstruktur steht.

---

## Phase 1 — Minimal Agent Runtime

**Ziel:** Ein funktionsfähiger Agent, der über die CLI Prompts entgegennimmt, Tools nutzt und iterativ arbeitet.

Phase 1 besteht aus drei Tracks. Track A und B sind voneinander unabhängig und können parallel entwickelt werden. Track C setzt beide voraus.

### Track A: Tool System

**Epic: `1A-tools`** · Parallel zu Track B

- `BaseTool` abstrakte Klasse + `ToolRegistry`
- 4 Core Tools: `read_file`, `write_file`, `edit_file`, `exec`
- Input-Validierung via JSON Schema
- Strukturiertes Error-Handling (Tool-Fehler ≠ Runtime-Fehler)

**Abhängigkeit:** Phase 0

### Track B: Anthropic OAuth Client

**Epic: `1B-oauth`** · Parallel zu Track A

- Token-Storage (`~/.workbench/tokens.json`) mit File-Lock
- Automatischer Token-Refresh (5-Minuten-Puffer vor Ablauf)
- Messages API Client mit Tool-Use Support
- Manueller Token-Paste: User kopiert Tokens aus dem Browser-OAuth-Flow
- Kein PKCE im Code — der OAuth-Flow läuft serverseitig (siehe `anthropic-oauth-provider.md`)

**Abhängigkeit:** Phase 0

### Track C: Agent Runtime + CLI

**Epic: `1C-runtime`**

- Session-Storage (JSON, `~/.workbench/sessions/`)
- Agent-Config: `model`, `system_prompt`, `tools`, `max_steps`
- Agent Runtime Loop: deterministisch, sequentiell, vollständige Historie
- CLI Entry Points: `workbench run "<prompt>"`, `workbench sessions`

**Abhängigkeiten:** Track A + Track B

**Erfolgskriterium Phase 1:**
```
workbench run "create a hello world server"
```
Der Agent erstellt Dateien, schreibt Code, führt ihn aus und korrigiert Fehler selbstständig.

---

## Phase 2 — Observability Layer

**Ziel:** Transparenz über alles, was im System passiert — als Grundlage für Dashboard und Debugging.

**Epic: `2-observability`**

- **Event Bus (Pub/Sub):** Zentrales Rückgrat für alle System-Events. Bridged in Phase 5 zu WebSocket.
- **Token Usage Tracking:** Pro Run + aggregierte Statistiken
- **Structured Logger:** JSON-Format, Severity Levels
- **Run Logger:** Vollständige Tool Call History mit Laufzeiten und Token-Verbrauch

**Abhängigkeit:** Phase 1C

---

## Phase 3 — Codebase Intelligence

**Ziel:** Der Agent versteht die Struktur eines Projekts und kann gezielt darin suchen.

**Epic: `3-codebase`** · Kann parallel zu Phase 2 entwickelt werden

- Shared Ignore-Utility (`.gitignore` + `.workbenchignore`)
- Neue Tools:
  - `search_code` — Regex-basierte Codesuche
  - `grep` — Mustersuche in Dateien
  - `list_files` — Verzeichnisbaum mit Filterung
  - `project_summary` — Strukturübersicht eines Projekts
- Alle Tools respektieren Ignore-Patterns

**Abhängigkeit:** Phase 1A (Tool-System)

---

## Phase 4 — Task System

**Ziel:** Strukturierte Aufgabenplanung — der Agent zerlegt komplexe Aufgaben in ausführbare Schritte.

**Epic: `4-tasks`**

- `Task`/`Plan`/`Step` Types (JSON-basiert, deterministisch, kein DAG)
- Plan-Storage (JSON Files, `~/.workbench/plans/`)
- **Plan-Generator:** LLM erstellt strukturierten Plan aus Aufgabenbeschreibung
- **Plan-Executor:** Lineare Step-Ausführung mit Fortschrittsanzeige, Pause/Resume
- CLI: `workbench plan "<aufgabe>"`, `workbench run plan-<id>`

**Abhängigkeiten:** Phase 1C + Phase 2

---

## Phase 5 — Dev Dashboard

**Ziel:** Web-basierte Oberfläche zur Überwachung und Steuerung von Agent-Runs in Echtzeit.

Phase 5 ist strikt sequentiell: Backend zuerst, dann Frontend.

### 5A: Backend (Fastify + WebSocket)

**Epic: `5A-dashboard-backend`**

- REST API: Sessions, Runs, Plans (read-only + Controls)
- WebSocket Server: Event Bus Bridge für Live-Events
- Run Controls: Start, Pause, Resume, Cancel

**Abhängigkeiten:** Phase 2 + Phase 4

### 5B: Frontend (React SPA)

**Epic: `5B-dashboard-frontend`**

- React + TypeScript + TailwindCSS
- WebSocket Client + Event Hooks
- Session/Run Viewer, Tool Call Viewer, Diff Viewer
- Kein Mock-Data — das Backend muss existieren

**Abhängigkeit:** Phase 5A

---

## Phase 6 — Multi-Agent Support

**Ziel:** Mehrere spezialisierte Agents, die koordiniert zusammenarbeiten.

**Epic: `6-multi-agent`**

- **Agent-Registry:** Mehrere Agent-Konfigurationen verwalten
- **Message-Passing:** In-Process Async Communication zwischen Agents
- **Orchestrator-Pattern:** Planner delegiert an spezialisierte Worker
- Neue Tools: `spawn_agent`, `send_message`, `list_agents`
- CLI: `workbench agents`, Multi-Agent-Runs

**Abhängigkeiten:** Phase 1C + Phase 4

---

## Phase 7 — Memory System

**Ziel:** Persistentes Wissen über Sessions hinweg — der Agent lernt aus vergangener Arbeit.

**Epic: `7-memory`**

- Memory Types: `session`, `project`, `knowledge`
- **LanceDB** embedded als Vector-Store
- Embedding-Provider (lokales Modell empfohlen — Offline-fähig, keine API-Kosten)
- **Session-Summarizer:** Automatische Zusammenfassungen nach jedem Run
- Neue Tools: `memory_store`, `memory_search`

**Abhängigkeit:** Phase 1C

---

## Phase 8 — Git Safety & Dev Workflow

**Ziel:** Sichere, isolierte Code-Änderungen mit automatischem Git-Workflow — inspiriert vom bewährten dev-pipeline Skill (siehe `dev-pipeline.md`).

**Epic: `8-git-safety`**

- **Git-Utilities:** Branch, Worktree, Commit, Diff als strukturierte API
- **Worktree-Manager:** Isolierter Worktree pro Run (`~/.workbench/worktrees/<run-id>/`)
- **Branch-Guards:** Tool-Level Protection — `write_file`/`edit_file` nur auf `agent/*` Branches
- **Auto-Commit:** Nach jedem dateiändernden Tool-Call (parseable Commit Messages)
- **Step-Level-Rollback** via `git revert`
- **DoD-Runner:** Definition-of-Done Checks aus Projekt-Config vor Run-Completion
- **PR-Workflow:** Automatisierte PR-Erstellung via `gh`, Diff-Summary als Body

**Abhängigkeit:** Phase 1A

---

## Phase 9 — Autonomous Dev Workflows

**Ziel:** Vorgefertigte, spezialisierte Workflows für häufige Entwicklungsaufgaben.

**Epic: `9-workflows`**

- **Workflow-Abstraktion:** Benannte Agent-Konfigurationen mit System-Prompt + Tool-Whitelist
- **Workflow-Registry:** Verwaltung und Erweiterung von Workflows
- 4 vorgefertigte Workflows:
  - `workbench fix-tests` — Test-Fixer (analysiert Fehler, fixt Source bevorzugt)
  - `workbench review <branch>` — Code-Reviewer (strukturiertes Markdown-Feedback)
  - `workbench refactor <target>` — Refactoring-Agent (mit Dry-Run-Modus)
  - `workbench docs` — Dokumentations-Agent (README, JSDoc, API, Changelog)
- Workflow-Runner + CLI-Integration

**Abhängigkeiten:** Phase 6 + Phase 8

---

## Zielzustand

```
Workbench — AI Dev OS
├── CLI (Commander.js)
│   ├── workbench run "<prompt>"
│   ├── workbench plan "<aufgabe>"
│   ├── workbench fix-tests / review / refactor / docs
│   └── workbench agents / sessions
├── Agent Runtime
│   ├── Deterministischer Loop
│   ├── Multi-Agent (Orchestrator/Worker)
│   └── Git-isolierte Worktrees
├── Tool System
│   ├── Core: read/write/edit/exec
│   ├── Codebase: search/grep/list/summary
│   ├── Agent: spawn/send/list
│   └── Memory: store/search
├── Dev Dashboard (React SPA)
│   ├── Session/Run Viewer
│   ├── Tool Call + Diff Viewer
│   └── Live via WebSocket
├── Task System (JSON Plans)
├── Memory (LanceDB)
└── Observability (Event Bus → Logs → Dashboard)
```

**Typischer Workflow:**
```
workbench plan "add authentication"
workbench run plan-42
```
Der Agent erstellt einen Plan, implementiert Code in einem isolierten Worktree, führt Tests aus, prüft die Definition-of-Done und erstellt einen PR. Der Entwickler reviewed und entscheidet.

---

## Dependency Graph

```
Phase 0 (Bootstrap)
├── Phase 1A (Tools) ──────────────┬── Phase 3 (Codebase Intel)
│                                  ├── Phase 8 (Git Safety) ──┐
├── Phase 1B (OAuth) ──┐           │                          │
│                      ├── Phase 1C (Runtime+CLI)             │
│                      │   ├── Phase 2 (Observability)        │
│                      │   │   ├── Phase 4 (Tasks) ───────┐   │
│                      │   │   │   ├── Phase 5A (Dash BE)  │   │
│                      │   │   │   │   └── Phase 5B (FE)   │   │
│                      │   │   │   ├── Phase 6 (Multi-Ag) ─┼───┤
│                      │   ├── Phase 7 (Memory)            │   │
│                      │   │                               │   │
│                      │   └───────────────────────────────>Phase 9 (Workflows)
```

---

## Referenzen

- Technologie-Entscheidungen: siehe `tech_stack.md`
- Architektur-Prinzipien: siehe `architecture_principles.md`
- OAuth-Flow: siehe `anthropic-oauth-provider.md`
- Git-Workflow: siehe `dev-pipeline.md`

---

## Phase 10 — E2E Testing & Integration Validation

**Ziel:** End-to-End Tests für alle Kernpfade. Validiert, dass die in Phase 0–9 implementierten Komponenten korrekt zusammenarbeiten. Automatische Qualitätssicherung jenseits von Unit Tests.

Phase 10 läuft quer zu allen vorherigen Phasen — sie deckt Integrationsfehler auf, die Unit Tests prinzipbedingt nicht finden (Auth-Header-Format, URL-Prefixes, Token-Flow, Multi-Turn Agent Loop).

### Epic 10: E2E Test-Infrastruktur (`e2e-test-infra`)
- Mock Anthropic Server (Fastify-basiert, freier Port)
- CLI Test Runner (Child Process Spawning)
- Fixture System (handgeschriebene LLM-Responses, kein Record&Replay)
- Isolierte Test-Umgebung (Temp Dirs, Token Fixtures)
- Separater Vitest Config (`vitest.config.e2e.ts`)

**Abhängigkeiten:** Keine

### Epic 11: E2E Smoke + CLI Tests (`e2e-smoke-cli`)
- Smoke Test (Build → Run → Auth → Response)
- Alle CLI-Commands: run, plan, plans, run-plan, dashboard, workflows
- **Fix-while-Testing:** Gefundene Bugs werden im selben PR gefixt
- Regressionstests für bekannte Bugs (Auth-Header, API-Prefix)

**Abhängigkeiten:** Epic 10

### Epic 12: E2E Agent Loop Tests (`e2e-agent-loop`)
- Single/Multi-Step Tool Use
- Error Recovery (Tool-Fehler → Agent reagiert)
- Max-Steps Limit
- Session Persistence

**Abhängigkeiten:** Epic 10, Epic 11 (Smoke)

### Epic 13: E2E Dashboard Tests (`e2e-dashboard`)
- REST API Endpoints (Fastify inject)
- WebSocket Event Bridge
- Frontend Component Rendering (@testing-library/react)

**Abhängigkeiten:** Epic 10

**Parallelisierbar:** Epic 11 ∥ Epic 13 (nach Epic 10). Epic 12 nach Epic 11.

**Erfolgskriterium Phase 10:**
```
npm run test:e2e
```
Alle E2E-Tests grün. Smoke Test, CLI Commands, Agent Loop und Dashboard funktionieren end-to-end mit gemocktem LLM.
