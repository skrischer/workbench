# Workbench

**AI Dev OS** — ein CLI-basiertes Entwicklungssystem mit LLM-gestützten Agenten.

Single-User, läuft auf einem VPS. Der Agent ist ein kontrollierter Operator innerhalb einer deterministischen Loop — kein autonomes System.

## Tech Stack

- **TypeScript** (strict mode, ESM)
- **Node.js 22+**
- **Commander.js** (CLI)
- **LanceDB** (Vector-basiertes Memory)
- **Anthropic API** (LLM Provider)

## Projektstruktur

```
src/
├── agent/        # Agent-Konfiguration (Model, Prompt, Tools, MaxSteps)
├── cli/          # CLI-Kommandos (run, auth, config, status)
├── config/       # Konfiguration (Models, User-Config)
├── events/       # TypedEventBus — type-safe Pub/Sub
├── git/          # Worktree-Isolation, Auto-Commit, Branch Guards
├── llm/          # Anthropic Client, Token-Management, Fallback
├── memory/       # Session-Summarizer, LanceDB Embeddings, Semantic Search
├── multi-agent/  # Orchestrator/Worker Pattern, AgentRegistry, MessageBus
├── runtime/      # Agent Loop, Lifecycle Hooks, Token Tracking
├── storage/      # Session- & Run-Persistenz
├── tools/        # File-Ops, Exec, Grep, Memory, Spawn-Agent u.a.
└── types/        # Shared TypeScript Types
```

## Setup

```bash
pnpm install
npm run build
```

## CLI Usage

```bash
# Agent mit Prompt ausführen
workbench run "Fix the failing tests in src/utils"

# Mit Optionen
workbench run "Refactor auth module" --model claude-sonnet-4-20250514 --max-steps 15

# Ohne automatische Session-Zusammenfassung
workbench run "Quick fix" --no-summarize

# Status anzeigen
workbench status

# Authentifizierung
workbench auth

# Konfiguration
workbench config
```

## Development

```bash
# Build
npm run build

# Type-Check
npm run check

# Tests
npm test

# E2E Tests
npm run test:e2e

# Watch Mode
npm run dev
npm run test:watch
```

## Status

**Phase 1 — Core Runtime**

Agent-Laufzeit, Tool-System, Memory, Multi-Agent Orchestration, Git-Integration.
