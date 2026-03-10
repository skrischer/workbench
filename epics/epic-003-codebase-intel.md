# Epic 3: codebase-intel — Codebase Navigation Tools

## Ziel
Dem Agent ermöglichen, Codebases effektiv zu navigieren: Dateibäume auflisten, Code durchsuchen, Pattern-basiert greppen, und Projekt-Zusammenfassungen generieren.

## Abhängigkeiten
- Epic 1A (tool-system) — BaseTool, ToolRegistry existieren
- Epic 2 (observability) — Vitest eingerichtet, Event Bus emitted tool:call/tool:result

## Tasks

### Task 3.1: `list-files` — Verzeichnisbaum-Tool + Shared Ignore-Utility + Tests

**Beschreibung:** `list_files` Tool + Shared Ignore-Utility (`src/tools/utils/ignore.ts`) die von allen Codebase-Tools genutzt wird. Unterstützt Tiefenlimit, Ignore-Patterns, glob-Filtering. Ausgabe als Baumstruktur.

**Dateien erstellt/geändert:**
- `src/tools/utils/ignore.ts` (Shared Ignore-Logic: defaultIgnores, shouldIgnore(), walkDirectory())
- `src/tools/list-files.ts` (ListFilesTool: path, depth?, pattern?, ignore?)
- `src/tools/__tests__/list-files.test.ts` (mind. 6 Tests)
- `src/tools/index.ts` (Barrel-Export)

**Input-Schema:**
```typescript
{
  path: string;
  depth?: number;        // default: 3
  pattern?: string;      // Glob-Filter
  ignore?: string[];     // Zusätzliche Ignores
}
```

**Acceptance Criteria:**
- Shared Ignore-Utility: defaultIgnores (node_modules, .git, dist, coverage, .next, build), `shouldIgnore()`, `walkDirectory()`
- Listet Dateien/Verzeichnisse rekursiv mit konfigurierbarer Tiefe
- Glob-Pattern filtert Ergebnisse
- Lesbare Baumstruktur mit Datei-Count
- Tests: Baum-Ausgabe, Tiefenlimit, Glob-Filter, Ignore-Patterns, Fehler-Case, leeres Verzeichnis
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S
**Parallelisierbar:** Nein (muss zuerst — erstellt Shared Utility)

### Task 3.2: `grep-tool` — Pattern-Suche + Tests

**Beschreibung:** `grep` Tool für Regex-basierte Suche in Dateien. Nutzt Shared Ignore-Utility.

**Dateien erstellt/geändert:**
- `src/tools/grep.ts` (GrepTool: pattern, path?, include?, context_lines?, max_results?)
- `src/tools/__tests__/grep.test.ts` (mind. 6 Tests)
- `src/tools/index.ts` (Barrel-Export)

**Acceptance Criteria:**
- Regex-Suche rekursiv, zeigt Datei + Zeilennummer + Kontext
- `include` filtert Dateitypen, `max_results` begrenzt Ausgabe (default: 50)
- Nutzt Shared Ignore-Utility
- Tests: einfaches Match, Regex, Kontext-Zeilen, Include-Filter, max_results-Limit, kein Match
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 3.1, parallel zu 3.3 + 3.4)

### Task 3.3: `search-code` — Semantische Code-Suche + Tests

**Beschreibung:** `search_code` Tool für Code-Konstrukte (Funktionen, Klassen, Interfaces). Regex-Heuristiken, kein AST-Parser.

**Dateien erstellt/geändert:**
- `src/tools/search-code.ts` (SearchCodeTool: query, path?, type?, language?)
- `src/tools/__tests__/search-code.test.ts` (mind. 6 Tests)
- `src/tools/index.ts` (Barrel-Export)

**Type-Filter:** function, class, interface, type, export, import, all

**Acceptance Criteria:**
- Findet Code-Konstrukte by name via Regex-Heuristiken
- Zeigt Datei, Zeilennummer, Match + 3 Folgezeilen
- Nutzt Shared Ignore-Utility
- Tests: Funktion finden, Klasse, Interface, Type-Filter, kein Treffer, Multi-Match
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 3.1, parallel zu 3.2 + 3.4)

### Task 3.4: `project-summary` — Projekt-Überblick + Tests

**Beschreibung:** `project_summary` Tool: package.json-Info, Verzeichnisstruktur, Dependencies, Scripts. Sofortiger Kontext über ein Projekt.

**Dateien erstellt/geändert:**
- `src/tools/project-summary.ts` (ProjectSummaryTool: path?)
- `src/tools/__tests__/project-summary.test.ts` (mind. 5 Tests)
- `src/tools/index.ts` (Barrel-Export)

**Acceptance Criteria:**
- Liest package.json: name, version, description, scripts, dependencies
- Generiert Verzeichnisbaum (Tiefe 2) via Shared Ignore-Utility
- Identifiziert Key-Files
- Markdown-Output
- Tests: vollständiges Projekt, ohne package.json, leeres Verzeichnis
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 3.1, parallel zu 3.2 + 3.3)

### Task 3.5: `tool-registration-update` — Registry erweitern + Integration-Test

**Beschreibung:** `createDefaultTools()` um 4 neue Tools erweitern (8 total).

**Dateien geändert:**
- `src/tools/defaults.ts` (4 neue Tools registrieren)
- `src/tools/__tests__/defaults.test.ts` (Integration-Test: alle 8 Tools)
- `src/tools/index.ts` (finale Barrel-Exports)

**Acceptance Criteria:**
- `createDefaultTools()` registriert alle 8 Tools
- `registry.list()` gibt 8 Tool-Namen zurück
- Integration-Test verifiziert vollständige Registry
- `npx tsc --noEmit` + `npm run build` + `npm run test` grün

**Komplexität:** S
**Parallelisierbar:** Nein (nach 3.2–3.4)

## Parallelisierungs-Plan
```
Wave 1 (sequentiell):
  Task 3.1 (list-files + ignore-utility)  ──

Wave 2 (parallel):
  Task 3.2 (grep)             ──┐
  Task 3.3 (search-code)      ──┤
  Task 3.4 (project-summary)  ──┘

Wave 3 (sequentiell):
  Task 3.5 (registration)     ──
```

## Agent-Bedarf
- **3 Worker** (max parallel in Wave 2)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test`

## Offene Fragen / Risiken
- **Grep-Performance:** `max_results` als Safety-Valve. Optional später `ripgrep`.
- **search_code ohne AST:** Bewusste Entscheidung — Regex-Heuristiken für 90% der Fälle ausreichend.
