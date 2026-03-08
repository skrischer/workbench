# Epic 17: dx-runtime — Developer Experience & Runtime Consolidation

## Ziel
Die drei größten DX-Schulden aus dem Audit beseitigen: Zwei parallele Agent Loops konsolidieren (verwirrend für Contributor), OAuth Token-Setup automatisieren (`workbench auth` statt manuelles JSON-Editieren), und den Workflow Runner vom Stub zur echten Implementierung bringen. Diese drei Punkte betreffen die tägliche Nutzung und Developer-Onboarding am stärksten.

## Abhängigkeiten
- Epic 1B (OAuth Client) — Token-Storage, Refresh-Logik
- Epic 1C (Agent Runtime) — CoreAgentLoop + AgentLoop
- Epic 9 (Workflows) — Runner-Stub, Workflow-Events

## Tasks

### Task 17.1: `consolidate-agent-loops` — CoreAgentLoop und AgentLoop zusammenführen

**Beschreibung:** Aktuell existieren zwei Agent Loop Implementierungen: `CoreAgentLoop` (372 LOC, Basic) und `AgentLoop` (383 LOC, mit Git-Integration). Das ist verwirrend und führt zu Divergenz. Lösung: Ein einziger `AgentLoop` mit optionaler Git-Integration via Config/Feature-Flags.

**Dateien erstellt/geändert:**
- `src/runtime/agent-loop.ts` (Hauptimplementierung — Git-Features optional)
- `src/runtime/core-agent-loop.ts` (entfernen oder als Re-Export beibehalten für Rückwärtskompatibilität)
- `src/runtime/index.ts` (Exports anpassen)
- `src/runtime/__tests__/agent-loop-consolidated.test.ts` (neu)

**Acceptance Criteria:**
- Ein einziger `AgentLoop` mit Config-Option `gitIntegration: boolean` (default: false)
- Wenn `gitIntegration: false`: Verhält sich wie bisheriger CoreAgentLoop
- Wenn `gitIntegration: true`: Worktree-Init, Branch-Guards, Auto-Commit (bisheriger AgentLoop)
- `CoreAgentLoop` als deprecated Re-Export oder entfernt (Design-Entscheidung im Task)
- Alle bestehenden Tests (Unit + E2E) bleiben grün
- Keine Verhaltensänderung für existierende Codepfade
- Mindestens 6 Tests: Basic Loop ohne Git, Loop mit Git, Config-Toggle, Feature-Flag-Verhalten
- `npx tsc --noEmit` + `npm run test` + `npm run test:e2e` grün

**Komplexität:** M  
**Parallelisierbar:** Nein — muss zuerst, da 17.3 darauf aufbaut

### Task 17.2: `workbench-auth` — CLI-Command für OAuth Token-Setup

**Beschreibung:** Interaktiver `workbench auth` Command der den Benutzer durch den OAuth PKCE Flow führt. Aktuell muss man Tokens manuell in `~/.workbench/tokens.json` eintragen — fehleranfällig und undokumentiert.

**Dateien erstellt/geändert:**
- `src/cli/auth-command.ts` (neu)
- `src/cli/index.ts` (Command registrieren)
- `src/llm/token-storage.ts` (ggf. Helper-Methode für initiales Schreiben)
- `src/cli/__tests__/auth-command.test.ts` (neu)

**Acceptance Criteria:**
- `workbench auth` startet interaktiven Flow:
  1. Zeigt Anthropic Console URL an (mit Client-ID und Scopes)
  2. Fragt nach Access Token (Paste aus Browser)
  3. Fragt nach Refresh Token (Paste aus Browser)
  4. Validiert Token-Format (Prefix-Check: `sk-ant-oat01-`, `sk-ant-ort01-`)
  5. Schreibt `~/.workbench/tokens.json`
  6. Bestätigung: "✅ Tokens gespeichert, Refresh in X Stunden"
- `workbench auth status` zeigt Token-Status (gültig/abgelaufen, Ablaufzeit)
- `workbench auth refresh` triggert manuellen Refresh
- Fehlerbehandlung: Ungültiges Token-Format → verständliche Fehlermeldung
- Mindestens 8 Tests: Happy Path, invalid format, status display, file creation
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M  
**Parallelisierbar:** Ja — unabhängig von 17.1

### Task 17.3: `workflow-runner-integration` — Runner mit Agent Loop verbinden

**Beschreibung:** Der Workflow Runner (Epic 9) ist ein Stub — er validiert Input und gibt Metadata zurück, führt aber keinen echten Agent-Durchlauf aus. Hier wird der Runner mit dem (konsolidierten) AgentLoop verbunden: Er erstellt eine Session, konfiguriert den Agent mit dem Workflow-spezifischen System-Prompt und Tool-Whitelist, und führt den Run durch.

**Dateien erstellt/geändert:**
- `src/workflows/runner.ts` (Stub → echte Implementierung)
- `src/workflows/__tests__/runner-integration.test.ts` (neu)
- `src/types/events.ts` (workflow:start/end Events emittieren)

**Acceptance Criteria:**
- `runner.run(input)` erstellt Session, konfiguriert Agent mit Workflow-Definition, führt AgentLoop aus
- Workflow-spezifische System-Prompts werden korrekt gesetzt
- Tool-Whitelist wird respektiert (nur die Tools des Workflows sind verfügbar)
- `workflow:start` und `workflow:end` Events werden auf dem EventBus emittiert
- `WorkflowResult` enthält echte Daten: status, output (finalResponse), tokenUsage, durationMs, filesModified
- Error-Handling: LLM-Fehler → `status: 'failed'` mit Error-Info
- Mindestens 8 Tests (mit Mock-LLM): Happy Path, Tool-Whitelist-Enforcement, Event-Emission, Error-Handling
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** L  
**Parallelisierbar:** Nein — nach 17.1 (braucht konsolidierten AgentLoop)

## Parallelisierungs-Plan

```
Wave 1 (parallel):
  Task 17.1 (consolidate-agent-loops)  ──┐
  Task 17.2 (workbench-auth)           ──┘

Wave 2 (sequentiell, nach 17.1):
  Task 17.3 (workflow-runner-integration) ──
```

## Agent-Bedarf
- **2 Worker** (max parallel in Wave 1)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test` + `npm run test:e2e`
- Nur noch ein Agent Loop (oder CoreAgentLoop als deprecated Alias)
- `workbench auth` funktioniert end-to-end
- `workbench fix-tests` / `review` / `refactor` / `docs` führen echte Agent-Runs aus
- Mindestens 22 neue Tests (6 + 8 + 8)
- Workflow-Events werden emittiert

## Offene Fragen / Risiken
- **Agent Loop Consolidation:** Breaking Change für Code der `CoreAgentLoop` direkt importiert. Mitigation: Re-Export als Alias beibehalten, deprecation warning.
- **Workflow Runner + LLM:** Integration-Tests brauchen Mock-Server. Kann die bestehende E2E-Infra (Epic 10) nutzen.
- **Auth-Flow UX:** PKCE Server-Side Flow heißt der User muss in die Anthropic Console und Tokens manuell kopieren. Langfristig: lokaler HTTP-Callback-Server für automatischen Token-Empfang (Scope dieses Epics: nur Paste-Flow).
