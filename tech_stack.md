# AI Dev OS -- Tech Stack

## Entscheidungsgrundlage

Der Tech Stack wurde aus 12 Prinzipien-Fragen abgeleitet, nicht aus
persönlichen Präferenzen. Jede Technologieentscheidung ist durch eine
Architektur-Anforderung erzwungen.

------------------------------------------------------------------------

## Kernentscheidungen

### Sprache: TypeScript

Begründung:

-   Interpreted → schnelle Iteration, kein Compile-Schritt (Bun/tsx)
-   Full-Stack → gleiche Sprache für Runtime, CLI, Dashboard
-   Shared Types → Agent, Tool, Session, Run, Task, Plan, Step als
    geteilte Typdefinitionen zwischen Backend und Frontend
-   JSON-native → Storage-Format ist JSON, natürlichste Sprache dafür
-   Type Safety → Determinismus wird durch Typsystem unterstützt

### Architektur: Event-driven, Sequential Agent Loop

Begründung:

-   Determinismus vor Concurrency
-   Alle Systemaktivitäten als Events
-   WebSocket als primärer Transportkanal zum Dashboard
-   Kein Polling, kein Page Reload

### Storage: JSON Files → SQLite Migrationspfad

Begründung:

-   Keine vorzeitige Komplexität
-   JSON reicht für Phase 1--4
-   SQLite als Upgrade wenn Queries nötig werden
-   Kein externes DB-System

------------------------------------------------------------------------

## Stack im Detail

### Agent Runtime & Backend

| Komponente       | Technologie        | Begründung                                      |
|------------------|--------------------|-------------------------------------------------|
| Runtime          | Node.js 22+ / Bun  | Native async/await, schnelle Iteration mit tsx   |
| HTTP + WebSocket | Fastify             | Performant, Plugin-System, native WS-Support     |
| Async Model      | async/await         | Sequentieller Agent Loop, deterministisch        |
| Event System     | Interner Event Bus  | Pub/Sub Pattern, bridged zu WebSocket            |

### CLI

| Komponente | Technologie   | Begründung                                |
|------------|---------------|-------------------------------------------|
| CLI        | Commander.js  | Phase 1, einfache Kommandostruktur        |
| TUI        | Ink           | Später, React-basiert → gleicher Mental Model wie Dashboard |

### LLM Anbindung

| Komponente          | Technologie                  | Begründung                                  |
|---------------------|------------------------------|---------------------------------------------|
| Primär              | Custom Anthropic OAuth Client | Claude Max Plan, kein API Key               |
| Später              | OpenRouter HTTP Client        | Für Perplexity/web_search                   |

Der Anthropic OAuth Client ist der kritischste Custom-Baustein.
Authentifizierung gegen den Consumer Claude Max Plan, nicht über die
Standard-API. Session-Token-Management notwendig.

Siehe `anthropic-oauth-provider.md` für den vollständigen OAuth 2.0 PKCE
Flow inkl. Token-Refresh-Mechanismus und File-Lock-Strategie.

### Storage

| Phase   | Technologie     | Begründung                              |
|---------|-----------------|----------------------------------------|
| 1--4    | JSON Files       | Einfach, kein Setup, direkt inspizierbar |
| Später  | SQLite           | Upgrade bei Bedarf, kein externer Service |

### Vector DB (Phase 7)

| Phase   | Technologie       | Begründung                              |
|---------|-------------------|-----------------------------------------|
| Initial | LanceDB embedded   | Zero-Ops, im selben Prozess, TS-Bindings |
| Später  | Qdrant             | Falls Skalierung nötig                   |

### Dev Dashboard (Phase 5)

| Komponente  | Technologie               | Begründung                              |
|-------------|---------------------------|-----------------------------------------|
| Framework   | React + TypeScript         | Shared Types mit Backend                |
| Styling     | TailwindCSS                | Utility-first, schnelle Iteration       |
| Echtzeit    | WebSocket Client           | Alle Events live, kein Polling          |
| Architektur | Eigenständige SPA          | Entkoppelt vom Backend                  |

REST nur für initiale Datenladung (Historical Runs vor WS-Connection).
Alles andere über WebSocket Events.

### Git Safety

| Komponente          | Mechanismus                          | Begründung                                  |
|---------------------|--------------------------------------|---------------------------------------------|
| Branch Strategy     | Agent Branch pro Run (`agent/run-<id>`) | Agent arbeitet nie auf main               |
| Worktrees           | Separates Arbeitsverzeichnis pro Run  | Physische Isolation ohne Container          |
| Auto-Commit         | Commit nach jedem dateiändernden Step | Granularer Rollback pro Step                |
| Tool Guards         | Branch-Check in Tool-Basisklasse      | Enforcement ohne externe Policy-Engine      |
| Merge               | Entwickler entscheidet nach Run       | Agent ist Operator, Entwickler ist Entscheider |
| Rollback            | `git revert` pro Step oder Branch Drop | Granular auf Run/Step-Ebene                |

Diff Visibility entsteht implizit durch die Branch-Strategie
(`git diff agent/run-<id>..main`). Kein separates Tooling nötig.

Siehe `dev-pipeline.md` für den vollständigen Workflow inkl. Epic-Branch-Flow,
DoD-Checks, Worktree-Management und Coder/Reviewer-Agent-Orchestrierung.

------------------------------------------------------------------------

## Bewusste Nicht-Entscheidungen

-   **Kein Sandbox** — Git Worktrees + Branch Guards ersetzen OS-Level-Isolation
-   **Kein Docker / CI/CD** — Single-User System, nicht reproduzierbar nötig
-   **Kein Plugin-System** — Neue Tools über Rebuild, nicht dynamisches Laden
-   **Keine Concurrency im Agent Loop** — Determinismus hat Vorrang
-   **Kein Multi-Provider von Tag 1** — Anthropic OAuth first, Abstraktion später

------------------------------------------------------------------------

## Zusammenfassung

    TypeScript (Full-Stack)
    ├── Agent Runtime    → Node.js/Bun + Fastify
    ├── CLI              → Commander.js → später Ink TUI
    ├── LLM              → Custom Anthropic OAuth → später OpenRouter
    ├── Storage           → JSON Files → später SQLite
    ├── Vector DB        → LanceDB embedded → später Qdrant
    ├── Event System     → Interner Bus → WebSocket Bridge
    └── Dashboard        → React + TypeScript + TailwindCSS
