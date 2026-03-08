# Epic 11: e2e-smoke-cli — E2E Smoke + CLI Tests (+ Bugfixes)

## Ziel
Alle CLI-Commands end-to-end testen. Smoke Test als Einstieg, dann jeder Command einzeln. **Fix-while-Testing:** Wenn ein Test einen Bug aufdeckt, wird der Bug im selben Worktree und PR gefixt. Der Test IST die Regression für den Fix.

## Abhängigkeiten
Epic 10 (e2e-test-infra) — Mock-Server, CLI-Runner, Fixtures müssen existieren.

## Kontext: Bekannte Bugs
- Bearer vs. x-api-key Auth-Header → **bereits gefixt (PR #13)**. Regressionstest erstellen.
- Dashboard `/api/api/` Doppel-Prefix → **Fix offen (PR #14)**. Regressionstest erstellen.

## Tasks

### Task 11.1: `smoke-test` — Build → Run → Response

**Beschreibung:** Der grundlegendste E2E-Test: `workbench run "say hi"` mit Mock-Server. Verifiziert: Binary baut, CLI parst Argument, Auth-Header korrekt, LLM-Response wird angezeigt, Exit 0.

**Dateien erstellt/geändert:**
- `src/test/e2e/smoke.test.ts` (ersetzt Dummy aus 10.5 mit echtem Smoke Test)

**Acceptance Criteria:**
- Test baut Projekt (`npm run build` oder pre-built)
- Mock-Server gibt simple Text-Response zurück
- CLI gibt LLM-Antwort auf stdout aus
- Exit Code 0
- Auth-Header ist korrekt (Regressionstest für PR #13: Bearer Token, nicht x-api-key)
- Mock-Server empfängt genau 1 Request

**Komplexität:** S
**Parallelisierbar:** Nein (zuerst — Smoke muss grün sein)

### Task 11.2: `run-command-e2e` — Run Command Varianten

**Beschreibung:** `workbench run` in verschiedenen Szenarien: Happy Path, Tool-Use, Error Paths, CLI Flags.

**Dateien erstellt/geändert:**
- `src/test/e2e/run-command.test.ts`

**Acceptance Criteria:**
- Happy Path: Text-Response → stdout
- Tool-Use Path: Mock gibt tool_use → CLI führt Tool aus → Mock gibt finale Antwort
- Error: Keine Token-Datei → verständliche Fehlermeldung, Exit ≠ 0
- Error: LLM gibt 401 → Fehlermeldung
- Error: LLM gibt 429 → Fehlermeldung
- Flags: `--model`, `--max-steps` werden durchgereicht
- Alle Bugs die auftauchen werden inline gefixt

**Komplexität:** M
**Parallelisierbar:** Ja (nach 11.1, parallel zu 11.3)

### Task 11.3: `plan-commands-e2e` — Plan + Plans + Run-Plan Commands

**Beschreibung:** Plan-Erstellung, Auflistung und Ausführung testen.

**Dateien erstellt/geändert:**
- `src/test/e2e/plan-commands.test.ts`

**Acceptance Criteria:**
- `workbench plan "..."` erstellt Plan, gibt Plan-ID auf stdout
- `workbench plans` listet existierende Pläne
- `workbench run-plan <id>` führt Plan aus
- Error: Plan-ID nicht gefunden → Fehlermeldung
- Alle Bugs inline gefixt

**Komplexität:** M
**Parallelisierbar:** Ja (nach 11.1, parallel zu 11.2)

### Task 11.4: `dashboard-e2e` — Dashboard Command + API

**Beschreibung:** Dashboard startet, Ports erreichbar, API antwortet, graceful shutdown.

**Dateien erstellt/geändert:**
- `src/test/e2e/dashboard.test.ts`

**Acceptance Criteria:**
- `workbench dashboard` startet Fastify Server
- HTTP GET auf Port → Response (Health-Endpoint oder Index)
- API-Prefix korrekt (Regressionstest für PR #14: kein `/api/api/` Doppel-Prefix)
- SIGINT/SIGTERM → graceful shutdown
- Port-Konflikt → verständliche Fehlermeldung
- Alle Bugs inline gefixt

**Komplexität:** M
**Parallelisierbar:** Ja (nach 11.1, parallel zu 11.2/11.3)

### Task 11.5: `workflow-commands-e2e` — Workflow CLI Commands

**Beschreibung:** Workflow-bezogene CLI Commands testen.

**Dateien erstellt/geändert:**
- `src/test/e2e/workflow-commands.test.ts`

**Acceptance Criteria:**
- Alle Workflow-Subcommands parsen korrekt
- Help-Output vorhanden
- Happy Path für Kernfunktionalität
- Error Paths für ungültige Inputs
- Alle Bugs inline gefixt

**Komplexität:** S
**Parallelisierbar:** Ja (nach 11.1, parallel zu 11.2–11.4)

## Parallelisierungs-Plan
```
Task 11.1 (smoke)                   ──── sequentiell (zuerst)
    │
    ├── Task 11.2 (run cmd)         ──── parallel
    ├── Task 11.3 (plan cmds)       ──── parallel
    ├── Task 11.4 (dashboard)       ──── parallel
    └── Task 11.5 (workflows)       ──── parallel
```

## Fix-while-Testing Workflow
```
1. Coder schreibt E2E-Test
2. Test läuft → FAIL (Bug oder unerwartetes Verhalten)
3. Coder fixt Bug im Produktionscode (selber Worktree!)
4. Test läuft → GREEN
5. Commit: "feat(e2e): run command e2e tests; fix token refresh race condition"
6. project-task.sh check → DoD (inkl. npm run test:e2e)
7. PR mit Test + Fix zusammen
```

**Ausnahme:** Bug in komplett anderem Bereich → separater PR, Test wird mit `it.todo()` markiert.

## Agent-Bedarf
- **4 Worker** (parallel in Wave 2)
- **1 Lead** zur Orchestrierung + Review

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm test` + `npm run test:e2e`
- Jeder CLI-Command hat mindestens 1 Happy-Path + 1 Error-Path E2E-Test
- Regressionstests für PR #13 (Auth) und PR #14 (API-Prefix) vorhanden
