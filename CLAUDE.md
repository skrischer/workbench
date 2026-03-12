# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Workbench** is an AI Dev OS — a CLI-based development system with LLM-powered agents. Single-user, runs on a VPS. The agent is a controlled operator within a deterministic loop, not an autonomous system.

## Commands

```bash
# Install
pnpm install

# Build (TypeScript → ESM JavaScript in dist/)
npm run build

# Type-check without emitting
npm run check          # or: npx tsc --noEmit

# Watch mode (dev)
npm run dev

# Unit/integration tests
npm test

# Single test file
npx vitest run src/path/to/file.test.ts

# Watch mode tests
npm run test:watch

# E2E tests (spawns compiled CLI as child process)
npm run test:e2e
```

**Definition of Done (DoD):** All four must pass: `npx tsc --noEmit`, `npm run build`, `npm test`, `npm run test:e2e`

## Architecture

### Core Primitives

- **Agent** — Configuration (model, systemPrompt, tools whitelist, maxSteps), not an instance
- **Tool** — Standardized interface: `name`, `description`, `inputSchema`, `execute()`. All capabilities are tools. Base class in `src/tools/base.ts`, registry in `src/tools/registry.ts`
- **Session** — Conversation context (messages, tool calls, status). Persisted in `~/.workbench/sessions/<id>/`
- **Run** — Concrete agent execution within a session. Fully logged and reproducible
- **Memory** — Vector-based semantic search via LanceDB. Session summaries → embeddings

### Agent Runtime Loop (`src/runtime/agent-loop.ts`)

Deterministic loop: call LLM → if tool requested: validate, check permissions, execute, publish event, continue → else: return response. Lifecycle hooks: `onBeforeRun`, `onAfterStep`, `onAfterRun`.

### Event System

`TypedEventBus` (`src/events/event-bus.ts`) — type-safe pub/sub. All system activities emit events (`run:start`, `tool:call`, `tool:result`, etc.). No polling.

### Multi-Agent (`src/multi-agent/`)

Orchestrator/Worker pattern via composition. AgentRegistry manages instances, MessageBus handles inter-agent communication (no shared state). Orchestrator analyzes step dependencies and spawns workers for parallel execution.

### Git Safety (`src/git/`)

- **Worktree isolation**: Each run gets its own `git worktree`
- **Branch guards**: Tool-level enforcement prevents direct writes to protected branches
- **Auto-commit**: After each file-modifying step
- Agent runs create `agent/run-<id>` branches

### Tool Execution Pipeline

Cross-cutting concerns (validation, permissions, cancellation, event publishing) live in the agent loop, not in tools. Tools receive a `ToolContext` with `signal` (AbortSignal), `permissions` (PermissionGuard), `eventBus`, and `metadata`.

### Memory System (`src/memory/`)

Session-Summarizer kondensiert abgeschlossene Sessions via LLM. Embeddings werden über `@xenova/transformers` generiert und in LanceDB gespeichert. Semantic Search über `recall` Tool. Auto-Memory Hook integriert sich in den Agent Lifecycle.

## Code Conventions

- **TypeScript strict mode** — no `any` types
- **ESM with `.js` extensions** — all imports must use `.js` extension (NodeNext module resolution)
- **Target**: ESNext, Node.js 22+
- **New tools**: extend `BaseTool` from `src/tools/base.ts`, register in `src/tools/registry.ts`
- **Types**: shared definitions in `src/types/` (events in `events.ts`, agent types in `agent.ts`, tool context in `tool-context.ts`)
- **No circular dependencies** between modules

## Testing

- **Unit tests**: Vitest, co-located with source (`__tests__/` per module), 15s timeout
- **E2E tests**: `src/test/e2e/`, spawn compiled CLI as black box, 30s timeout
- **No live LLM calls**: Mock Fastify server simulates Anthropic Messages API
- **Fixture-based**: Handwritten minimal response fixtures, deterministic
- **Isolated**: Each test gets temp dir with token fixtures and agent config
- **Env overrides**: `ANTHROPIC_API_URL` and `WORKBENCH_HOME` redirect to mock server / temp dir

## Git & Branching

- **Base branch**: `develop` (PRs target this)
- **Main branch**: `main`
- **Worktree base**: `/tmp/workbench-worktrees`
- **GitHub repo**: `skrischer/workbench`
- **WICHTIG: Niemals direkt auf `develop` oder `main` arbeiten.** Alle Änderungen müssen in einem Git Worktree erfolgen. Vor jeder Code-Änderung einen Worktree erstellen (via `EnterWorktree` Tool oder `git worktree add`).

## Design System (Web UI)

All Web UI work must follow `design-system/MASTER.md`. Page-specific overrides in `design-system/pages/<page>.md` take precedence.

Key decisions:
- **Style**: Modern Terminal (Dark-only, OLED-optimized)
- **Colors**: Electric Blue accent (#3B82F6), Slate-based dark backgrounds
- **Typography**: JetBrains Mono (headings/code/data) + IBM Plex Sans (body/UI)
- **Border radius**: 4px default
- **Mobile nav**: Bottom nav + drawer
- **Icons**: Lucide React (no emojis as functional icons)
- **Shared code**: `src/shared/` for stores, hooks, types (TUI + Web share logic, not components)

Context-aware retrieval: When building a page, first check `design-system/pages/<page>.md`, then fall back to `design-system/MASTER.md`.

## Web UI Dev Setup

### Gateway (recommended — single process)

The Gateway unifies Fastify (API + WebSocket) and Vite (HMR) into one process:

```bash
npm run build && workbench gateway --dev          # Fastify + Vite on :3000, HMR on :24678
```

**Architecture (Gateway Dev Mode):**
```
Browser
  → http://localhost:3000           (Web UI with HMR)
  → Fastify + Vite middleware       (one process)
  → /ws  → WebSocket bridge
  → HMR  → ws://localhost:24678
```

**Options:**
```bash
workbench gateway --dev                # Dev mode with Vite HMR
workbench gateway --dev --port 8080    # Custom port
workbench gateway --dev --host 0.0.0.0 # External access (e.g. via Tailscale)
workbench gateway                      # Prod mode (serves dist/web static files)
```

### Legacy: Separate Vite + Fastify

Still works for standalone Vite usage:

```bash
npm run dev:web          # Vite Dev Server on :5173 (proxies /ws → :3000)
workbench web            # Fastify + WebSocket on :3000
```

### Tailscale HTTPS Proxy

For external access via Tailscale, point the proxy at the Gateway:

```bash
tailscale serve --bg --set-path / --https 3333 http://127.0.0.1:3000
```

**Notes:**
- Gateway `--host 0.0.0.0` required for Tailscale to reach the server
- `allowedHosts` in `vite.config.ts` includes `srv1364794.tiffany-kelvin.ts.net`
- React StrictMode double-mount causes a harmless "WebSocket closed before established" warning in dev — ignorable

## Reviewer Focus

- TypeScript strict compliance
- ESM imports (`.js` extensions)
- Error handling
- Input validation
