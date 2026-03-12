# Epic 15: input-validation — JSON Schema Validation für Tool-Inputs

## Ziel
Runtime-Validierung von Tool-Inputs gegen ihre JSON Schemas hinzufügen. Aktuell werden Tool-Inputs vom LLM direkt an `tool.execute()` weitergereicht — ohne Prüfung ob Required Fields vorhanden sind oder Typen stimmen. Ein invalider Input kann Tools crashen oder undefiniertes Verhalten auslösen.

## Abhängigkeiten
- Epic 1A (Tool System) — inputSchema ist definiert, wird aber nicht validiert
- Epic 1C (Agent Runtime) — `CoreAgentLoop.executeTool()` ist der Validierungs-Punkt

## Tasks

### Task 15.1: `add-ajv-validator` — JSON Schema Validator integrieren

**Beschreibung:** `ajv` als Dependency hinzufügen und einen Tool-Input-Validator bauen, der inputSchema gegen die tatsächlichen Inputs prüft.

**Dateien erstellt/geändert:**
- `package.json` (ajv Dependency hinzufügen)
- `src/tools/validator.ts` (neu — validateToolInput Funktion)
- `src/tools/__tests__/validator.test.ts` (neu)
- `src/tools/index.ts` (Export erweitern)

**Acceptance Criteria:**
- `ajv` als Dependency installiert
- `validateToolInput(schema, input)` gibt `{ valid: true }` oder `{ valid: false, errors: string[] }` zurück
- Validiert: required fields, type checks (string, number, boolean), unknown properties (warn, nicht reject)
- Mindestens 10 Tests: valid input, missing required, wrong type, extra properties, empty input, nested objects
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S  
**Parallelisierbar:** Nein — muss vor 15.2

### Task 15.2: `integrate-validation` — Validation in Agent Loop einbauen

**Beschreibung:** `validateToolInput()` in `CoreAgentLoop.executeTool()` einbauen. Bei Validation-Failure: `ToolResult` mit `success: false` und verständlicher Fehlermeldung zurückgeben (kein Crash, kein Throw).

**Dateien erstellt/geändert:**
- `src/runtime/core-agent-loop.ts` (executeTool erweitern)
- `src/runtime/agent-loop.ts` (gleiche Änderung, falls executeTool dort auch existiert)
- `src/runtime/__tests__/input-validation.test.ts` (neu)

**Acceptance Criteria:**
- `executeTool()` validiert Input vor `tool.execute()` Aufruf
- Bei Validation-Fehler: `ToolResult` mit `success: false`, `is_error: true`, Error beschreibt was falsch ist
- Agent Loop crasht NICHT bei invalidem Input — LLM bekommt Fehlermeldung und kann korrigieren
- Bestehende E2E-Tests bleiben grün (valide Inputs werden nicht blockiert)
- Mindestens 5 Tests: valid passthrough, missing required → error result, wrong type → error result, multiple errors
- `npx tsc --noEmit` + `npm run test` + `npm run test:e2e` grün

**Komplexität:** S  
**Parallelisierbar:** Nein — nach 15.1

## Parallelisierungs-Plan

```
Wave 1 (sequentiell):
  Task 15.1 (add-ajv-validator)       ──

Wave 2 (sequentiell):
  Task 15.2 (integrate-validation)    ──
```

## Agent-Bedarf
- **1 Worker** (sequentiell)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test` + `npm run test:e2e`
- `ajv` in package.json
- Alle bestehenden 562+ Tests bleiben grün
- Mindestens 15 neue Tests (10 + 5)
- Kein Tool-Execute ohne vorherige Validation

## Offene Fragen / Risiken
- **Performance:** ajv kompiliert Schemas — bei vielen Tool-Calls pro Run könnte das kosten. Mitigation: Schema einmal kompilieren, Validator cachen.
- **Strictness:** `additionalProperties: false` würde LLM-generierte Extra-Fields blocken. Empfehlung: warn statt reject für Extra-Properties.
- **AgentLoop vs CoreAgentLoop:** Beide Loops haben `executeTool()`. Entweder beide ändern oder in BaseTool.execute() verschieben (Design-Entscheidung in Task 15.2).
