# Epic 2: observability — Event Bus, Run Logs, Token Tracking

## Ziel
Vollständige Transparenz über Agent-Aktivitäten: typisierter Event Bus als zentrales Nervensystem, persistente Run Logs, Token Usage Tracking. Gleichzeitig Vitest als Test-Framework einführen.

## Abhängigkeiten
- Epic 1C (runtime-cli) — Run-Lifecycle und Tool-Execution existieren
- Epic 1A (tool-system) — ToolResult-Typen werden erweitert

## Tasks

### Task 2.1: `vitest-setup` — Test-Framework einrichten

**Beschreibung:** Vitest als Test-Framework konfigurieren. TypeScript-Support, Path-Aliases, Test-Scripts in package.json.

**Dateien erstellt/geändert:**
- `vitest.config.ts` (Vitest-Config mit TypeScript-Support, resolve aliases)
- `package.json` (devDependencies: vitest; scripts: `"test": "vitest run"`, `"test:watch": "vitest"`)
- `src/test-utils/index.ts` (Shared Test-Helpers: `createMockToolResult()`, `createMockMessage()`)
- `.openclaw-dev.json` (DoD-Array um `"npm run test"` erweitern)

**Acceptance Criteria:**
- `npm run test` läuft (auch bei 0 Tests → exit 0)
- `vitest.config.ts` hat korrekte TypeScript-Paths
- Test-Helpers sind importierbar
- `npx tsc --noEmit` kompiliert fehlerfrei
- `.openclaw-dev.json` DoD enthält `"npm run test"` (damit ab Epic 2 alle Pipeline-PRs auch Tests durchlaufen)

**Komplexität:** S
**Parallelisierbar:** Ja (parallel zu 2.2)

### Task 2.2: `event-bus` — Typisierter Event Bus + Tests

**Beschreibung:** Interner Event Bus als Pub/Sub-System. Alle System-Events fließen durch den Bus. Typisiert via Event-Map, synchrone Emits. Grundlage für WebSocket-Bridge (Epic 5A). Inklusive Unit-Tests.

**Dateien erstellt/geändert:**
- `src/types/events.ts` (EventMap Interface mit Event-Typen und Payloads)
- `src/events/event-bus.ts` (TypedEventBus: `on()`, `off()`, `emit()`, `once()`)
- `src/events/__tests__/event-bus.test.ts` (mind. 6 Test-Cases)
- `src/events/index.ts` (Barrel-Export)

**Event-Map (initial):**
```typescript
interface EventMap {
  'run:start': { runId: string; agentConfig: AgentConfig; prompt: string };
  'run:end': { runId: string; result: string; tokenUsage: TokenUsage };
  'run:error': { runId: string; error: string };
  'run:step': { runId: string; stepIndex: number; message: Message };
  'tool:call': { runId: string; toolName: string; input: unknown; stepIndex: number };
  'tool:result': { runId: string; toolName: string; result: ToolResult; durationMs: number };
  'llm:request': { runId: string; model: string; messageCount: number };
  'llm:response': { runId: string; model: string; tokenUsage: StepTokenUsage };
}
```

**Acceptance Criteria:**
- Event Bus ist generisch typisiert — TypeScript erzwingt korrekte Payloads
- `on/off/emit/once` funktionieren korrekt
- Listener-Entfernung via `off()` oder Return-Value von `on()`
- Keine externen Dependencies
- Tests: emit+on, once (einmal), off (Entfernung), mehrere Listener, keine Cross-Event Interference
- `npx tsc --noEmit` kompiliert + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (parallel zu 2.1)

### Task 2.3: `token-tracking` — Token Usage Tracking + Tests

**Beschreibung:** Token-Tracking pro LLM-Call und kumulativ pro Run. Inklusive Unit-Tests.

**Dateien erstellt/geändert:**
- `src/types/tokens.ts` (StepTokenUsage, RunTokenUsage Interfaces)
- `src/runtime/token-tracker.ts` (TokenTracker: `recordStep()`, `getRunUsage()`, `reset()`)
- `src/runtime/__tests__/token-tracker.test.ts` (mind. 4 Tests)
- `src/runtime/index.ts` (Barrel-Export)

**Acceptance Criteria:**
- TokenTracker akkumuliert korrekt über mehrere Steps
- Cache-Token-Felder sind optional
- Tests: Akkumulation, Reset, optionale Cache-Felder, leerer Tracker
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S
**Parallelisierbar:** Ja (parallel zu 2.4, nach 2.1)

### Task 2.4: `run-logger` — Persistente Run Logs + Tests

**Beschreibung:** RunLogger persistiert Agent-Runs als JSON-Dateien. In-memory sammeln, bei `endRun()` flushen. Inklusive Tests.

**Dateien erstellt/geändert:**
- `src/types/run.ts` (RunMetadata, RunLog Interfaces)
- `src/storage/run-logger.ts` (RunLogger: `startRun()`, `logStep()`, `logToolCall()`, `endRun()`, `loadRun()`)
- `src/storage/__tests__/run-logger.test.ts` (mind. 5 Tests, temp-dir cleanup)
- `src/storage/index.ts` (Barrel-Export)

**Datei-Struktur:**
```
runs/<run-id>/
  run.json        # { id, startedAt, endedAt, status, prompt, tokenUsage }
  messages.json   # [ { role, content, toolCalls?, stepIndex } ]
  tool-calls.json # [ { toolName, input, output, durationMs, stepIndex } ]
```

**Acceptance Criteria:**
- Run-Lifecycle: start → log → end erstellt korrekte JSON-Dateien
- `loadRun()` Roundtrip funktioniert
- JSON pretty-printed (menschlich lesbar)
- Tests mit temporärem Verzeichnis + Cleanup
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (parallel zu 2.3, nach 2.1)

### Task 2.5: `runtime-integration` — Event Bus in Runtime Loop integrieren

**Beschreibung:** Event Bus, TokenTracker und RunLogger in den bestehenden Agent Runtime Loop integrieren. Runtime emitted Events, Tracker und Logger subscriben.

**Dateien geändert:**
- `src/runtime/agent-loop.ts` (Event Bus injizieren, Events emittieren)
- `src/runtime/create-runtime.ts` (Factory: TokenTracker + RunLogger an Bus hängen)
- `src/runtime/index.ts` (Barrel-Export)

**Acceptance Criteria:**
- Runtime akzeptiert Event Bus als Dependency (Injection)
- Events werden korrekt emitted: run:start, llm:response, tool:call, tool:result, run:end, run:error
- TokenTracker und RunLogger sind austauschbar (nicht hartcodiert)
- `npx tsc --noEmit` + `npm run build` + `npm run test` fehlerfrei

**Komplexität:** M
**Parallelisierbar:** Nein (nach 2.2 + 2.3 + 2.4)

## Parallelisierungs-Plan
```
Wave 1 (parallel):
  Task 2.1 (vitest-setup)   ──┐
  Task 2.2 (event-bus)      ──┤
                                │
Wave 2 (parallel, nach Wave 1):│
  Task 2.3 (token-tracking) ──┤
  Task 2.4 (run-logger)     ──┤
                                │
Wave 3 (sequentiell):          │
  Task 2.5 (runtime-integration) ─┘
```

## Agent-Bedarf
- **2 Worker** (max parallel in Wave 1 und Wave 2)
- **1 Lead** zur Orchestrierung

## DoD-Anpassungen
- `npx tsc --noEmit` + `npm run build` + **`npm run test`** (NEU ab Epic 2)
- `.openclaw-dev.json` DoD-Array muss um `npm run test` erweitert werden (erster Task in diesem Epic)

## Offene Fragen / Risiken
- **Sync-Emit:** Event Bus emitted synchron. Listener die async Arbeit machen (RunLogger fs.write) machen das intern. RunLogger sammelt in-memory und flusht bei `endRun()`.
- **runs/ Verzeichnis:** Konfigurierbar mit Default `~/.workbench/runs/`.
- **Token-Tracking bei Streaming:** Kein Streaming in Phase 1. Anpassung wenn nötig.
