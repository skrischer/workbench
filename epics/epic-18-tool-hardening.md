# Epic 18: tool-hardening — Tool System Sicherheit & Robustheit

## Ziel
Das Tool System für Multi-Agent-Betrieb absichern und robuster machen. Drei Features die im Audit als wichtig identifiziert wurden: Path-basierte Permissions (Agents dürfen nur in bestimmten Verzeichnissen schreiben), Tool Cancellation (lang laufende exec-Calls abbrechen), und Tool Aliases (DX-Verbesserung für LLM-Flexibilität).

**Warum jetzt:** Epic 6 (Multi-Agent) ist implementiert — aber Agents können aktuell überall im Filesystem schreiben. Das ist ein Sicherheitsrisiko sobald Agents autonom arbeiten (Epic 9).

## Abhängigkeiten
- Epic 1A (Tool System) — BaseTool, ToolRegistry
- Epic 6 (Multi-Agent) — Agent-Registry, SpawnConfig
- Epic 8 (Git Safety) — Branch Guards (ergänzend zu Path Permissions)

## Tasks

### Task 18.1: `tool-permissions` — Path-basierte Zugriffskontrolle

**Beschreibung:** Agent-spezifische Pfad-Allowlists für schreibende Tools (write_file, edit_file, exec mit Seiteneffekten). Definiert über SpawnConfig oder AgentConfig.

**Dateien erstellt/geändert:**
- `src/tools/permissions.ts` (neu — PermissionGuard Klasse)
- `src/tools/__tests__/permissions.test.ts` (neu)
- `src/types/agent.ts` (AgentConfig/SpawnConfig um `allowedPaths` erweitern)
- `src/tools/write-file.ts` (Permission-Check einbauen)
- `src/tools/edit-file.ts` (Permission-Check einbauen)

**Acceptance Criteria:**
- `PermissionGuard` prüft ob ein Pfad in der Allowlist liegt
- Allowlist unterstützt Glob-Patterns (`/tmp/workbench-*/**`, `/home/user/project/**`)
- Schreibende Tools (`write_file`, `edit_file`) prüfen vor Ausführung
- Bei Violation: `ToolResult` mit `success: false` und klarer Fehlermeldung (kein Crash)
- Wenn keine Allowlist konfiguriert: alle Pfade erlaubt (Rückwärtskompatibel)
- `exec` prüft `cwd` gegen Allowlist (nicht jeden möglichen Seiteneffekt — pragmatisch)
- Mindestens 10 Tests: erlaubter Pfad, verbotener Pfad, Glob-Match, kein Guard → alles erlaubt, nested paths
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M  
**Parallelisierbar:** Ja

### Task 18.2: `tool-cancellation` — AbortController für lang laufende Tools

**Beschreibung:** `exec` Tool mit AbortController erweitern. Ermöglicht das Abbrechen von lang laufenden Prozessen (Builds, Tests) durch den Agent Loop oder User-Intervention.

**Dateien erstellt/geändert:**
- `src/tools/base.ts` (optionalen `AbortSignal` Parameter in execute())
- `src/tools/exec.ts` (AbortSignal an child_process weitergeben)
- `src/tools/__tests__/exec-cancellation.test.ts` (neu)
- `src/runtime/agent-loop.ts` (AbortController pro Run, Signal an Tools weiterreichen)

**Acceptance Criteria:**
- `BaseTool.execute()` akzeptiert optionalen `options: { signal?: AbortSignal }`
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
- **AbortSignal Propagation:** Nicht alle Tools können sinnvoll abgebrochen werden (write_file ist atomar). Nur exec profitiert real — aber die API sollte generisch sein.
- **Alias-Konflikte:** Was wenn ein LLM `run` aufruft und es sowohl als Alias für `exec` als auch als echtes Tool existiert? Regel: echte Tools haben Vorrang.
