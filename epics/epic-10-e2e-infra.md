# Epic 10: e2e-test-infra — E2E Test-Infrastruktur

## Ziel
Wiederverwendbare E2E-Infrastruktur aufbauen: Mock Anthropic Server, CLI Test Runner, Fixture System, isolierte Test-Umgebung. Grundlage für alle E2E-Epics (11–13).

## Abhängigkeiten
Keine — nutzt bestehenden kompilierten Code.

## Tasks

### Task 10.1: `mock-anthropic-server` — Fastify-basierter Mock der Anthropic Messages API

**Beschreibung:** Einen Mock-HTTP-Server implementieren, der die Anthropic `/v1/messages` API simuliert. Fastify-basiert, startet auf freiem Port, gibt konfigurierbare Responses zurück (Text, Tool-Use, Streaming, Errors). Zeichnet eingehende Requests auf für Assertions.

**Prerequisite:** `run-command.ts` (bzw. AgentConfig/CLI) muss `ANTHROPIC_API_URL` Env-Variable auswerten und an `AnthropicClient({ apiUrl })` durchreichen. Der Client selbst unterstützt `apiUrl` bereits (Zeile 18 in `anthropic-client.ts`). Der CLI-Entrypoint muss es nur noch lesen und weiterleiten.

**Dateien erstellt/geändert:**
- `src/cli/run-command.ts` (Env-Variable `ANTHROPIC_API_URL` → `apiUrl` Config)
- `src/test/mock-anthropic-server.ts` (MockAnthropicServer: Fastify, freier Port, Response-Queue + Matcher)

**Acceptance Criteria:**
- `ANTHROPIC_API_URL` Env-Variable wird vom CLI `run` Command ausgewertet
- Mock-Server startet auf Port 0 (OS wählt freien Port)
- POST `/v1/messages` gibt konfigurierte Responses zurück (FIFO oder Match-Funktion)
- Server zeichnet alle Requests auf (`server.calls` Array)
- Unterstützt Error-Responses (401, 429, 500)
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** M
**Parallelisierbar:** Nein (muss zuerst — Prerequisite für alles)

### Task 10.2: `cli-runner` — CLI Test Runner Helper

**Beschreibung:** Helper-Modul das `dist/cli/index.js` als Child Process spawnt. Captured stdout, stderr, Exit Code. Injiziert Environment-Variablen (z.B. `ANTHROPIC_API_URL`, `WORKBENCH_HOME`). Konfigurierbarer Timeout.

**Dateien erstellt/geändert:**
- `src/test/cli-runner.ts` (runCli: command, args, options → {stdout, stderr, exitCode})

**Acceptance Criteria:**
- Spawnt `node dist/cli/index.js <args>` als Child Process
- Captured stdout + stderr als Strings
- Gibt Exit Code zurück
- Timeout konfigurierbar (Default: 30s), tötet Prozess bei Überschreitung
- Env-Variablen injizierbar
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Ja (nach 10.1, parallel zu 10.3)

### Task 10.3: `fixtures` — LLM Response Fixtures

**Beschreibung:** Handgeschriebene, minimale Anthropic API Response-Fixtures. Kein Record&Replay — deterministische, wartbare Fixtures.

**Dateien erstellt/geändert:**
- `src/test/__fixtures__/responses/simple-text.json` (einfache Text-Antwort)
- `src/test/__fixtures__/responses/tool-use-read-file.json` (Tool Use: read_file)
- `src/test/__fixtures__/responses/tool-use-write-file.json` (Tool Use: write_file)
- `src/test/__fixtures__/responses/multi-turn.json` (Array: tool_use → text)
- `src/test/__fixtures__/responses/error-401.json` (Auth Error)
- `src/test/__fixtures__/responses/error-429.json` (Rate Limit)
- `src/test/__fixtures__/tokens.json` (Gültige Token-Fixture für Tests)
- `src/test/__fixtures__/agent-config.json` (Minimale Agent-Config)
- `src/test/__fixtures__/index.ts` (Barrel-Export aller Fixtures)

**Acceptance Criteria:**
- Alle Fixtures sind valides JSON und entsprechen dem Anthropic API Schema
- Fixtures importierbar via `import { simpleText, toolUseReadFile } from '../__fixtures__/index.js'`
- Token-Fixture hat gültiges Format (nicht abgelaufener Timestamp)
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Ja (nach 10.1, parallel zu 10.2)

### Task 10.4: `test-env` — Isolierte Test-Umgebung

**Beschreibung:** Helper der temporäres Verzeichnis erstellt mit vorbereiteten Fixtures (tokens.json, agent config). Setzt `WORKBENCH_HOME` auf temp-dir. Cleanup nach Test.

**Dateien erstellt/geändert:**
- `src/test/test-env.ts` (createTestEnv: setup + teardown, temp dir, env vars)

**Acceptance Criteria:**
- Erstellt temp-dir mit `tokens.json` und `agent.json` aus Fixtures
- Gibt `env` Object zurück (WORKBENCH_HOME, ANTHROPIC_API_URL)
- `cleanup()` Funktion löscht temp-dir
- Keine Interferenz mit echtem `~/.workbench/`
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Ja (parallel zu 10.2/10.3)

### Task 10.5: `vitest-e2e-config` — Separater Vitest Config + Script + DoD-Update

**Beschreibung:** Eigener Vitest-Config für E2E-Tests mit höherem Timeout. Neues npm Script. DoD in `.openclaw-dev.json` erweitern.

**Dateien erstellt/geändert:**
- `vitest.config.e2e.ts` (testDir: src/test/e2e, timeout: 30000)
- `package.json` (Script: `"test:e2e": "vitest run --config vitest.config.e2e.ts"`)
- `.openclaw-dev.json` (DoD erweitern: `"npm run test:e2e"` hinzufügen)
- `src/test/e2e/smoke.test.ts` (1 Dummy-Test der Mock-Server + CLI-Runner nutzt → beweist dass Infra funktioniert)

**Acceptance Criteria:**
- `npm run test:e2e` führt E2E-Tests aus (separiert von Unit-Tests)
- Dummy-Smoke-Test: startet Mock-Server, spawnt CLI, assertet Exit Code
- `.openclaw-dev.json` DoD enthält `npm run test:e2e`
- `npx tsc --noEmit` + `npm run build` + `npm test` laufen weiterhin

**Komplexität:** S
**Parallelisierbar:** Nein (nach 10.2 + 10.3 + 10.4)

## Parallelisierungs-Plan
```
Task 10.1 (mock-server + env var)   ──── sequentiell (zuerst, enthält Prerequisite)
    │
    ├── Task 10.2 (cli-runner)      ──── parallel
    ├── Task 10.3 (fixtures)        ──── parallel
    └── Task 10.4 (test-env)        ──── parallel
         │
Task 10.5 (vitest config + dummy)   ──── sequentiell (danach)
```

## Agent-Bedarf
- **3 Worker** (parallel in Wave 2)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm test`
- `npm run test:e2e` existiert und Dummy-Test ist grün
- Mock-Server, CLI-Runner, Fixtures, Test-Env funktionieren zusammen

## Risiken
- **WORKBENCH_HOME Env-Variable:** Muss vom Storage/Token-Code respektiert werden. Falls hardcoded auf `~/.workbench/` → Fix nötig (analog zum ANTHROPIC_API_URL Pattern).
