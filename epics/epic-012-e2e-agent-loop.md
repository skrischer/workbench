# Epic 12: e2e-agent-loop — E2E Agent Loop Tests

## Ziel
Multi-Step Agent-Interaktionen end-to-end testen: Tool-Nutzung, Error Recovery, Step Limits, Session Persistence. Testet das Herz des Systems — den deterministischen, sequentiellen Agent Loop.

## Abhängigkeiten
- Epic 10 (e2e-test-infra) — Infrastruktur
- Epic 11 Task 11.1 (smoke) — Smoke Test muss grün sein

## Tasks

### Task 12.1: `single-tool-use` — Agent nutzt ein Tool

**Beschreibung:** Mock-Server antwortet mit tool_use (read_file) → CLI führt Tool aus → sendet tool_result → Mock antwortet mit Text. Verifiziert den kompletten Single-Turn Tool-Use Cycle.

**Dateien erstellt/geändert:**
- `src/test/e2e/agent-loop/single-tool.test.ts`

**Acceptance Criteria:**
- Mock-Server gibt tool_use Response (read_file mit Pfad)
- CLI führt read_file aus (in temp-dir mit vorbereiteter Datei)
- Mock-Server empfängt 2. Request mit tool_result im Messages-Array
- Finale Text-Antwort erscheint auf stdout
- Exit Code 0

**Komplexität:** M
**Parallelisierbar:** Nein (zuerst — Basis für 12.2+12.3)

### Task 12.2: `multi-step-chain` — Agent nutzt mehrere Tools sequentiell

**Beschreibung:** Mock-Server orchestriert eine Kette: read_file → edit_file → exec. Response-Queue mit 4 Responses (3x tool_use, 1x final text). Verifiziert Multi-Turn Konversation.

**Dateien erstellt/geändert:**
- `src/test/e2e/agent-loop/multi-step.test.ts`

**Acceptance Criteria:**
- 3 Tool Calls in Sequenz (read → edit → exec)
- Jeder Tool Call wird korrekt ausgeführt
- Mock-Server empfängt wachsende Messages-Arrays (Konversationshistorie)
- Finale Antwort nach 4 LLM-Calls
- Dateien im temp-dir wurden tatsächlich modifiziert

**Komplexität:** M
**Parallelisierbar:** Ja (nach 12.1, parallel zu 12.3)

### Task 12.3: `error-recovery` — Agent reagiert auf Tool-Fehler

**Beschreibung:** Tool gibt Fehler zurück (Datei nicht gefunden, exec non-zero) → Mock-Server bekommt Fehler als tool_result → antwortet mit korrigiertem Tool Call oder Erklärung.

**Dateien erstellt/geändert:**
- `src/test/e2e/agent-loop/error-recovery.test.ts`

**Acceptance Criteria:**
- read_file auf nicht-existierende Datei → tool_result mit error
- Mock-Server empfängt Fehler-tool_result
- Agent (Mock) versucht Alternative oder gibt Erklärung
- Kein Crash, sauberer Exit

**Komplexität:** M
**Parallelisierbar:** Ja (nach 12.1, parallel zu 12.2)

### Task 12.4: `max-steps-limit` — Step-Limit wird eingehalten

**Beschreibung:** Agent mit `--max-steps 3` → Mock gibt endlos tool_use → Agent stoppt nach 3 Steps.

**Dateien erstellt/geändert:**
- `src/test/e2e/agent-loop/max-steps.test.ts`

**Acceptance Criteria:**
- Mock-Server gibt immer tool_use zurück (Endlosschleife simuliert)
- CLI mit `--max-steps 3` stoppt nach 3 Tool Calls
- Verständliche Meldung auf stderr/stdout dass Limit erreicht
- Exit Code ≠ 0 (oder definierter "limit reached" Code)
- Mock-Server hat genau 3 Requests empfangen

**Komplexität:** S
**Parallelisierbar:** Ja (nach 12.1, parallel zu 12.2/12.3)

### Task 12.5: `session-persistence` — Sessions werden persistiert

**Beschreibung:** Run erzeugt Session-Datei. Session enthält Messages, Tool Calls, Status. Verifiziert Storage-Integration.

**Dateien erstellt/geändert:**
- `src/test/e2e/agent-loop/session-persistence.test.ts`

**Acceptance Criteria:**
- Nach Run existiert Session-Datei in `WORKBENCH_HOME/sessions/`
- Session-JSON enthält: messages Array, status, model, timestamps
- Tool Calls sind in der Session enthalten
- Session-Datei ist valides JSON

**Komplexität:** S
**Parallelisierbar:** Ja (nach 12.1)

## Parallelisierungs-Plan
```
Task 12.1 (single-tool)             ──── sequentiell (zuerst)
    │
    ├── Task 12.2 (multi-step)      ──── parallel
    ├── Task 12.3 (error-recovery)  ──── parallel
    ├── Task 12.4 (max-steps)       ──── parallel
    └── Task 12.5 (session-persist) ──── parallel
```

## Agent-Bedarf
- **4 Worker** (parallel in Wave 2)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm test` + `npm run test:e2e`
- Agent Loop funktioniert deterministisch in allen getesteten Szenarien
