# Epic 1A: tool-system — Tool-Basisklasse + 4 Core Tools

## Ziel
Das Tool-System als Fundament aller Agent-Fähigkeiten aufbauen: abstraktes Tool-Interface, Tool-Registry, und die 4 minimalen Tools (read_file, write_file, edit_file, exec), die für einen funktionierenden Coding-Agent nötig sind.

## Abhängigkeiten
Epic 0 (bootstrap) — Projektstruktur + Types müssen existieren.

## Tasks

### Task 1A.1: `tool-interface` — Tool-Basisklasse + Registry

**Beschreibung:** Das abstrakte Tool-Interface und eine Tool-Registry implementieren. Jedes Tool hat `name`, `description`, `input_schema` (JSON Schema), und eine `execute(input): Promise<ToolResult>` Methode. Die Registry registriert und findet Tools by name.

**Dateien erstellt/geändert:**
- `src/types/index.ts` (ToolDefinition, ToolResult, ToolInput erweitern — waren Placeholder)
- `src/tools/base.ts` (abstrakte BaseTool-Klasse mit Interface-Enforcement)
- `src/tools/registry.ts` (ToolRegistry: register, get, list, has)
- `src/tools/index.ts` (Barrel-Export aktualisieren)

**Acceptance Criteria:**
- `BaseTool` ist abstrakt und erzwingt `name`, `description`, `input_schema`, `execute()`
- `ToolResult` hat `output: string`, `error?: string`, `metadata?: Record<string, unknown>`
- `ToolRegistry` kann Tools registrieren und by name abrufen
- Duplicate-Registration wirft Error
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Nein (muss zuerst in diesem Epic)

### Task 1A.2: `core-tools-read-write` — read_file + write_file Tools

**Beschreibung:** Die ersten beiden Core-Tools implementieren. `read_file` liest Dateien (mit optionalem offset/limit für große Dateien), `write_file` schreibt Dateien (erstellt Verzeichnisse automatisch via `mkdir -p`).

**Dateien erstellt/geändert:**
- `src/tools/read-file.ts` (ReadFileTool: path, offset?, limit?)
- `src/tools/write-file.ts` (WriteFileTool: path, content)
- `src/tools/index.ts` (Barrel-Export aktualisieren)

**Acceptance Criteria:**
- `ReadFileTool` liest Dateiinhalt als String, gibt Fehler bei nicht-existierender Datei
- `ReadFileTool` unterstützt `offset` (Zeile ab) und `limit` (max Zeilen)
- `WriteFileTool` schreibt Datei, erstellt parent-Verzeichnisse wenn nötig
- Beide erben von `BaseTool` und haben korrektes `input_schema`
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Ja (nach 1A.1, parallel zu 1A.3)

### Task 1A.3: `core-tools-edit-exec` — edit_file + exec Tools

**Beschreibung:** Die weiteren zwei Core-Tools: `edit_file` für zeilenbasierte Edits (old_string → new_string Replacement), `exec` für Shell-Befehle (mit Timeout und cwd).

**Dateien erstellt/geändert:**
- `src/tools/edit-file.ts` (EditFileTool: path, old_string, new_string)
- `src/tools/exec.ts` (ExecTool: command, cwd?, timeout_ms?)
- `src/tools/index.ts` (Barrel-Export aktualisieren)

**Acceptance Criteria:**
- `EditFileTool` ersetzt exakten `old_string` durch `new_string` in Datei
- `EditFileTool` gibt Fehler wenn `old_string` nicht gefunden oder mehrdeutig (mehrere Matches)
- `ExecTool` führt Shell-Command aus, gibt stdout+stderr zurück
- `ExecTool` hat konfigurierbaren Timeout (default: 30s) und optionales `cwd`
- `ExecTool` gibt Exit-Code im Result zurück
- Beide erben von `BaseTool` mit korrektem `input_schema`
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Ja (nach 1A.1, parallel zu 1A.2)

### Task 1A.4: `tool-registration` — Default-Registry mit allen 4 Tools

**Beschreibung:** Eine Factory-Funktion `createDefaultTools()` die alle 4 Core-Tools in einer Registry registriert und zurückgibt. Entry-Point für den Agent Runtime Loop.

**Dateien erstellt/geändert:**
- `src/tools/defaults.ts` (createDefaultTools(): ToolRegistry)
- `src/tools/index.ts` (finaler Barrel-Export mit allen Exports)

**Acceptance Criteria:**
- `createDefaultTools()` gibt ToolRegistry mit 4 registrierten Tools zurück
- Alle Tools sind via `registry.get("read_file")` etc. abrufbar
- `registry.list()` gibt alle 4 Tool-Namen zurück
- `npx tsc --noEmit` + `npm run build` laufen fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Nein (nach 1A.2 + 1A.3)

## Parallelisierungs-Plan
```
Task 1A.1 (tool-interface)          ──── sequentiell (zuerst)
    │
    ├── Task 1A.2 (read+write)      ──── parallel
    │
    └── Task 1A.3 (edit+exec)       ──── parallel
         │
Task 1A.4 (tool-registration)      ──── sequentiell (danach)
```

## Agent-Bedarf
- **2 Worker** (parallel in Wave 2)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build`
- Alle 4 Tools registrierbar und via Registry abrufbar

## Offene Fragen / Risiken
- **edit_file Strategie:** old_string/new_string ist simpel aber robust. Alternative wäre line-number-basiert, aber das ist fragiler bei Agent-Nutzung.
- **exec Sicherheit:** In Phase 1 kein Sandboxing — Agent arbeitet mit vollem Zugriff. Safety kommt in Epic 8.
