# Epic 18: tool-hardening — Tool System Sicherheit & Robustheit

## Ziel
Das Tool System für Multi-Agent-Betrieb absichern und robuster machen. Drei Features die im Audit als wichtig identifiziert wurden: Path-basierte Permissions (Agents dürfen nur in bestimmten Verzeichnissen schreiben), Tool Cancellation (lang laufende exec-Calls abbrechen), und Tool Aliases (DX-Verbesserung für LLM-Flexibilität).

**Warum jetzt:** Epic 6 (Multi-Agent) ist implementiert — aber Agents können aktuell überall im Filesystem schreiben. Das ist ein Sicherheitsrisiko sobald Agents autonom arbeiten (Epic 9).

**Design-Rahmen: Middleware-Pipeline im Agent Loop**

Dieses Epic folgt dem Middleware-Pipeline-Pattern — alle Cross-Cutting Concerns (Validation, Permissions, Cancellation) werden im Agent Loop orchestriert, NICHT in den Tools selbst. Tools bleiben pure Functions.

```
executeTool(tool, input, context):
  1. validate(input, tool.schema)       // Epic 15 — Input Validation
  2. checkPermissions(input, context)    // Epic 18.1 — Path Permissions
  3. result = tool.execute(input, ctx)   // Core — Tool bleibt dumm
  4. publishEvent('tool:end', result)    // Bestehend — Observability
```

Alle Tasks in diesem Epic implementieren Middleware-Stufen oder erweitern den `ToolContext`, der durch die Pipeline gereicht wird:

```typescript
interface ToolContext {
  signal?: AbortSignal;          // Epic 18.2 — Cancellation
  permissions?: PermissionGuard; // Epic 18.1 — Path Access
  eventBus?: EventBus;           // Bestehend — Event Publishing
}
```

## Abhängigkeiten
- Epic 1A (Tool System) — BaseTool, ToolRegistry
- Epic 6 (Multi-Agent) — Agent-Registry, SpawnConfig
- Epic 8 (Git Safety) — Branch Guards (ergänzend zu Path Permissions)

## Tasks

### Task 18.1: `tool-permissions` — Path-basierte Zugriffskontrolle

**Beschreibung:** Agent-spezifische Pfad-Allowlists als Middleware im Agent Loop. Die Permission-Prüfung findet VOR `tool.execute()` statt — Tools selbst bleiben unverändert (pure Functions). Der `PermissionGuard` wird über den `ToolContext` an die Pipeline übergeben.

**Dateien erstellt/geändert:**
- `src/tools/permissions.ts` (neu — PermissionGuard Klasse)
- `src/tools/__tests__/permissions.test.ts` (neu)
- `src/types/agent.ts` (AgentConfig/SpawnConfig um `allowedPaths` erweitern)
- `src/types/tool-context.ts` (neu — ToolContext Interface mit permissions)
- `src/runtime/agent-loop.ts` (Permission-Check als Middleware-Stufe in executeTool)

**Acceptance Criteria:**
- `PermissionGuard` prüft ob ein Pfad in der Allowlist liegt
- Allowlist unterstützt Glob-Patterns (`/tmp/workbench-*/**`, `/home/user/project/**`)
- Agent Loop prüft Permissions als Middleware-Stufe VOR `tool.execute()` — Tools selbst werden NICHT geändert
- Bei Violation: `ToolResult` mit `success: false` und klarer Fehlermeldung (kein Crash, kein Tool-Execute)
- Schreibende Tools erkannt über Tool-Metadata (`tool.sideEffects: true` oder Name-basiert)
- Wenn keine Allowlist konfiguriert: alle Pfade erlaubt (Rückwärtskompatibel)
- `exec` prüft `cwd` gegen Allowlist (nicht jeden möglichen Seiteneffekt — pragmatisch)
- Mindestens 10 Tests: erlaubter Pfad, verbotener Pfad, Glob-Match, kein Guard → alles erlaubt, nested paths
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M  
**Parallelisierbar:** Ja

### Task 18.2: `tool-cancellation` — AbortController für lang laufende Tools

**Beschreibung:** Generisches `ToolContext` Object einführen und `exec` Tool mit AbortController-Support erweitern. Der Context konsolidiert alle Cross-Cutting Concerns (Signal, Permissions, EventBus) in einem Object statt die Tool-Signatur mit einzelnen Parametern zu zerfasern.

**Dateien erstellt/geändert:**
- `src/types/tool-context.ts` (ToolContext Interface erweitern — signal, permissions, eventBus)
- `src/tools/base.ts` (execute() akzeptiert optionalen `context?: ToolContext`)
- `src/tools/exec.ts` (AbortSignal aus context.signal an child_process weitergeben)
- `src/tools/__tests__/exec-cancellation.test.ts` (neu)
- `src/runtime/agent-loop.ts` (AbortController pro Run, ToolContext erstellen und durchreichen)

**Acceptance Criteria:**
- `BaseTool.execute()` akzeptiert optionalen `context?: ToolContext` (nicht einzelne Parameter)
- `ExecTool` bricht child process ab wenn Signal feuert
- Abgebrochene Tools geben `ToolResult` mit `success: false, error: "Cancelled"` zurück
- Agent Loop erstellt AbortController pro Run, reicht Signal an alle Tool-Calls weiter
- `run.cancel()` oder Pause triggert den AbortController
- Bestehende Tools ohne Signal-Support funktionieren weiter (optional parameter)
- Mindestens 8 Tests: Normal exec, abort during exec, abort before exec, cleanup nach abort
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M  
**Parallelisierbar:** Ja

### Task 18.3: `tool-aliases` — Tool-Name-Aliase in Registry

**Beschreibung:** ToolRegistry um Alias-Support erweitern. LLMs generieren manchmal `read` statt `read_file` — Aliases machen das System fehlertoleranter.

**Dateien erstellt/geändert:**
- `src/tools/registry.ts` (Alias-Map, registerAlias(), get() prüft Aliases)
- `src/tools/defaults.ts` (Default-Aliases registrieren)
- `src/tools/__tests__/registry-aliases.test.ts` (neu)

**Acceptance Criteria:**
- `registry.registerAlias('read', 'read_file')` registriert Alias
- `registry.get('read')` gibt read_file Tool zurück
- `registry.list()` gibt nur kanonische Namen zurück (keine Aliases)
- `registry.listWithAliases()` gibt beides zurück
- Default-Aliases: `read` → `read_file`, `write` → `write_file`, `edit` → `edit_file`, `run` → `exec`
- Alias auf nicht-existierendes Tool → Error
- Alias-Kollision mit echtem Tool-Namen → Error
- Mindestens 7 Tests
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S  
**Parallelisierbar:** Ja

## Parallelisierungs-Plan

```
Wave 1 (parallel — alle unabhängig):
  Task 18.1 (tool-permissions)    ──┐
  Task 18.2 (tool-cancellation)   ──┤
  Task 18.3 (tool-aliases)        ──┘
```

## Agent-Bedarf
- **3 Worker** (max parallel)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test` + `npm run test:e2e`
- Mindestens 25 neue Tests (10 + 8 + 7)
- Bestehende Tests bleiben grün
- Rückwärtskompatibel (keine Permissions → alles erlaubt, kein Signal → normales Verhalten, keine Aliases → nur kanonische Namen)

## Offene Fragen / Risiken
- **Permission Granularity:** Nur Pfad-basiert oder auch Command-basiert (exec darf nur `npm test` aber nicht `rm -rf /`)? Empfehlung: Nur Pfade für v1, Command-Allowlist als Follow-up.
- **AbortSignal Propagation:** Nicht alle Tools können sinnvoll abgebrochen werden (write_file ist atomar). Nur exec profitiert real — aber ToolContext ist generisch und zukunftssicher.
- **ToolContext Dependency:** Einführung von ToolContext ist ein Cross-Epic Concern (auch relevant für Epic 15, 17). Empfehlung: ToolContext-Interface früh definieren (in 18.2), andere Epics referenzieren es.
- **Alias-Konflikte:** Was wenn ein LLM `run` aufruft und es sowohl als Alias für `exec` als auch als echtes Tool existiert? Regel: echte Tools haben Vorrang.
