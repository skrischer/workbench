# Epic 1C: runtime-cli — Agent Runtime Loop + CLI

## Ziel
Den Agent Runtime Loop (think → act → observe) und das CLI-Interface (`workbench run "<prompt>"`) implementieren. Nach diesem Epic ist der Agent funktionsfähig: User gibt Prompt, Agent nutzt Tools, gibt Ergebnis zurück.

## Abhängigkeiten
- Epic 1A (tool-system) — Tools + Registry müssen existieren
- Epic 1B (oauth-client) — AnthropicClient muss existieren

## Tasks

### Task 1C.1: `session-storage` — Session-Persistenz als JSON

**Beschreibung:** Sessions als JSON-Dateien speichern und laden. Eine Session enthält Messages (User + Assistant + Tool-Results), Metadata, und Status. Verzeichnisstruktur: `~/.workbench/sessions/<session-id>/session.json`.

**Dateien erstellt/geändert:**
- `src/storage/session-storage.ts` (SessionStorage: create, load, save, addMessage, list)
- `src/types/index.ts` (Session Interface erweitern: id, messages, status, createdAt, updatedAt; Message-Types: UserMessage, AssistantMessage, ToolResultMessage)

**Acceptance Criteria:**
- `create()` generiert UUID-basierte Session-ID, erstellt Verzeichnis + JSON
- `save()` schreibt Session als JSON (atomisch: write to temp, rename)
- `load(id)` liest Session von Disk
- `addMessage(id, message)` lädt, appendet, speichert
- `list()` gibt alle Session-IDs mit Metadata zurück (kein voller Message-Load)
- Messages haben Rollen: `user`, `assistant`, `tool_result`
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Ja (parallel zu 1C.2)

### Task 1C.2: `agent-config` — Agent-Konfiguration

**Beschreibung:** AgentConfig laden und validieren. Definiert model, system_prompt, max_steps, und verfügbare Tools. Default-Config als Fallback.

**Dateien erstellt/geändert:**
- `src/agent/config.ts` (loadAgentConfig, defaultAgentConfig, validateConfig)
- `src/types/index.ts` (AgentConfig Interface erweitern: model, systemPrompt, maxSteps, tools)

**Acceptance Criteria:**
- `defaultAgentConfig` hat sinnvolle Defaults: model `claude-sonnet-4-20250514`, maxSteps 25, Standard-System-Prompt
- `loadAgentConfig(path?)` lädt optional aus JSON-Datei, merged mit Defaults
- Validierung: maxSteps > 0, model nicht leer
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Ja (parallel zu 1C.1)

### Task 1C.3: `runtime-loop` — Agent Runtime Loop

**Beschreibung:** Der Kern des Systems: der sequentielle Agent-Loop. Nimmt Prompt entgegen, ruft LLM auf, führt Tool-Calls aus, appendet Ergebnisse, wiederholt bis `end_turn` oder max_steps erreicht. Deterministisch, keine Concurrency.

**Dateien erstellt/geändert:**
- `src/runtime/agent-loop.ts` (AgentLoop: run(prompt) → RunResult)
- `src/runtime/index.ts` (Barrel-Export)
- `src/types/index.ts` (Run Interface erweitern: id, sessionId, status, steps, result, tokenUsage)

**Loop-Logik:**
```
1. Session erstellen
2. User-Message appendieren
3. WHILE step < maxSteps AND status != "completed":
   a. Messages + Tools an LLM senden
   b. Assistant-Response appendieren
   c. IF stop_reason == "tool_use":
      - Für jeden tool_use Block:
        - Tool aus Registry holen
        - execute(input) aufrufen
        - ToolResult-Message appendieren
      - Weiter bei 3a
   d. IF stop_reason == "end_turn":
      - Status = "completed"
   e. step++
4. Session speichern
5. RunResult zurückgeben
```

**Acceptance Criteria:**
- Loop läuft deterministisch: ein LLM-Call → Tool-Execution → nächster LLM-Call
- Mehrere tool_use Blocks in einer Response werden sequentiell ausgeführt
- Max-Steps wird enforced (Status "max_steps_reached" statt Endlosloop)
- Tool-Errors werden als ToolResult mit `is_error: true` zurückgeschickt (Agent kann korrigieren)
- Session wird nach jedem Step gespeichert (Crash-Recovery)
- RunResult enthält: sessionId, steps, finalResponse, tokenUsage (summiert)
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** M
**Parallelisierbar:** Nein (nach 1C.1 + 1C.2)

### Task 1C.4: `cli-run` — CLI Entry Point (`workbench run`)

**Beschreibung:** CLI mit Commander.js implementieren. Hauptbefehl: `workbench run "<prompt>"`. Initialisiert Tools, LLM-Client, Agent-Config, und startet den Runtime Loop. Gibt Ergebnis auf stdout aus.

**Dateien erstellt/geändert:**
- `src/cli/index.ts` (Commander Setup: Programm-Name, Version, Befehle)
- `src/cli/run-command.ts` (run-Command: Prompt entgegennehmen, Loop starten, Output)
- `src/index.ts` (Entry-Point: CLI bootstrappen)
- `package.json` (bin-Feld: `"workbench": "./dist/index.js"`, dependency: commander)

**Acceptance Criteria:**
- `npx tsx src/index.ts run "hello"` startet den Agent-Loop mit dem Prompt
- Output: Assistant-Antworten auf stdout, Tool-Calls mit Kurzinfo auf stderr
- Exit-Code 0 bei Erfolg, 1 bei Fehler
- `--max-steps <n>` Flag überschreibt Default
- `--model <model>` Flag überschreibt Default-Model
- Fehler bei fehlender Token-Datei: klare Meldung mit Verweis auf Setup
- `npx tsc --noEmit` + `npm run build` laufen fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Nein (nach 1C.3)

## Parallelisierungs-Plan
```
Task 1C.1 (session-storage) ──┐
                               ├── parallel
Task 1C.2 (agent-config)    ──┘
                               │
Task 1C.3 (runtime-loop)    ──── sequentiell (braucht beide)
    │
Task 1C.4 (cli-run)         ──── sequentiell (braucht Loop)
```

## Agent-Bedarf
- **2 Worker** (parallel in Wave 1)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build`
- `npx tsx src/index.ts run "hello"` startet ohne Crash (LLM-Call schlägt fehl ohne Token — das ist OK, der Ablauf muss stimmen)

## Offene Fragen / Risiken
- **System-Prompt:** Default kurz und generisch, wird später verfeinert.
- **Streaming:** Kein Streaming in Phase 1. Kommt optional später.
- **Crash-Recovery:** Session-Save nach jedem Step, aber Resume erst mit Task-System (Epic 4).
- **commander als erste Runtime-Dependency:** Bewusste Entscheidung — CLI ist Kern-Feature.
