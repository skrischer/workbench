# Epic 14: unit-test-coverage — Fehlende Unit Tests für Core-Module

## Ziel
Unit-Test-Coverage für die drei Module schließen, die im Audit als ungetestet identifiziert wurden: Core Tools (Epic 1A), LLM/OAuth-Module (Epic 1B) und Branch Guards (Epic 8). Aktuell existieren nur Integration-/E2E-Tests für diese Bereiche — Unit Tests für Error Cases, Edge Cases und isolierte Logik fehlen komplett.

## Abhängigkeiten
- Epic 1A (Tool System) — Code existiert, Tests fehlen
- Epic 1B (OAuth Client) — Code existiert, Tests fehlen
- Epic 8 (Git Safety) — Code existiert, Branch-Guard Tests fehlen

## Tasks

### Task 14.1: `core-tool-unit-tests` — Unit Tests für die 4 Core Tools

**Beschreibung:** Unit Tests für `read_file`, `write_file`, `edit_file` und `exec` schreiben. Jedes Tool braucht Happy Path, Error Cases und Edge Cases.

**Dateien erstellt/geändert:**
- `src/tools/__tests__/read-file.test.ts` (neu)
- `src/tools/__tests__/write-file.test.ts` (neu)
- `src/tools/__tests__/edit-file.test.ts` (neu)
- `src/tools/__tests__/exec.test.ts` (neu)

**Acceptance Criteria:**
- `read_file`: Happy Path, non-existent file, offset/limit, empty file, binary file detection
- `write_file`: Happy Path, parent dir creation (mkdir -p), permission error, overwrite existing
- `edit_file`: Happy Path (1 match), 0 matches → error, >1 matches → error, empty old_string
- `exec`: Happy Path, non-zero exit code, timeout, cwd option, stderr capture
- Mindestens 8 Tests pro Tool (32 Tests gesamt)
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M  
**Parallelisierbar:** Ja — alle 4 Test-Dateien sind voneinander unabhängig

### Task 14.2: `llm-unit-tests` — Unit Tests für LLM/OAuth-Module

**Beschreibung:** Unit Tests für Token-Storage, File-Lock, Token-Refresh und Anthropic-Client. Fokus auf Edge Cases die im E2E nicht abgedeckt sind: Token Expiry während Request, Refresh-Failure, Race Conditions, Network Errors.

**Dateien erstellt/geändert:**
- `src/llm/__tests__/token-storage.test.ts` (neu)
- `src/llm/__tests__/token-refresh.test.ts` (neu)
- `src/llm/__tests__/anthropic-client.test.ts` (neu)

**Acceptance Criteria:**
- `token-storage`: Read/Write roundtrip, File-Lock Verhalten, korrupte JSON-Datei, fehlende Datei
- `token-refresh`: 5-Minuten-Puffer korrekt, Double-Checked Locking, Refresh-Failure (401/400), Token bereits refreshed nach Lock
- `anthropic-client`: Request-Format (Bearer Auth), Tool-Use Response Parsing, 429 Handling, Network Error
- Mindestens 6 Tests pro Datei (18 Tests gesamt)
- Keine echten API-Calls — alles gemockt
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M  
**Parallelisierbar:** Ja — alle 3 Test-Dateien sind voneinander unabhängig

### Task 14.3: `branch-guard-tests` — Unit Tests für Branch Guards

**Beschreibung:** Branch-Guard-Logik isoliert testen: Protected Branch Detection, Agent Branch Assertion, Tool-Wrapping mit Guard Check.

**Dateien erstellt/geändert:**
- `src/git/__tests__/branch-guard.test.ts` (neu)

**Acceptance Criteria:**
- `isProtectedBranch()`: main, master, develop, release/*, hotfix/* → true; agent/foo, feature/bar → false
- `assertOnAgentBranch()`: Throws auf protected, passes auf agent/*
- `wrapTool()`: Tool wird blockiert auf protected branch, Tool läuft auf agent/* branch
- Glob-Pattern-Matching (release/1.0, hotfix/urgent)
- Config-Flag `enabled: false` → Guard deaktiviert
- Mindestens 9 Tests
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S  
**Parallelisierbar:** Ja — unabhängig von 14.1 und 14.2

## Parallelisierungs-Plan

```
Wave 1 (parallel — alle unabhängig):
  Task 14.1 (core-tool-unit-tests)    ──┐
  Task 14.2 (llm-unit-tests)          ──┤
  Task 14.3 (branch-guard-tests)      ──┘
```

## Agent-Bedarf
- **3 Worker** (max parallel in Wave 1)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test` + `npm run test:e2e`
- Mindestens 59 neue Tests (32 + 18 + 9)
- Keine bestehenden Tests brechen
- Alle neuen Tests grün

## Offene Fragen / Risiken
- **File-Lock Testing:** Token-Storage verwendet File-Locks — Tests müssen Race Conditions simulieren (z.B. parallele Refresh-Attempts). Ggf. Timing-sensitive Tests mit Retries absichern.
- **Mock-Strategie LLM:** Anthropic-Client Tests brauchen Mock-Fetch oder Mock-Server. Empfehlung: `vi.fn()` für fetch, kein echter Server.
