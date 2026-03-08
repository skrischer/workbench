# Workbench

**AI Dev OS** — ein CLI-basiertes Entwicklungssystem mit LLM-gestützten Agenten

## Tech Stack

- **TypeScript** (strict mode)
- **Node.js 22+**
- **Commander.js** (CLI framework)
- **Fastify** (planned, web interface)

## Projektstruktur

```
src/
├── agents/       # Agent definitions and orchestration
├── cli/          # Command-line interface
├── dashboard/    # Dashboard components (planned)
├── events/       # Event system
├── git/          # Git integration
├── llm/          # LLM provider integrations
├── memory/       # Memory and context management
├── runtime/      # Runtime and execution engine
├── storage/      # Persistence layer
├── tasks/        # Task management
├── tools/        # Agent tools
├── types/        # TypeScript type definitions
└── workflows/    # Workflow definitions
```

## Setup

```bash
npm install
npm run build
```

## Status

**Phase 0 — Bootstrap**

Core infrastructure setup and initial agent framework.
