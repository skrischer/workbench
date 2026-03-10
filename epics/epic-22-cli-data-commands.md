# Epic 22: cli-data-commands — CLI Commands für Data Management

## Ziel
User-facing CLI Commands für Zugriff auf Run/Session/Memory-Daten ohne Dashboard-Zwang. Ermöglicht Data-Management via CLI für headless VPS/SSH-Sessions. Schließt UX-Gap zwischen "Dashboard vorhanden" und "täglicher CLI-Workflow".

**Problem:** Aktuell muss User entweder Dashboard starten oder JSON-Files manuell durchsuchen.  
**Lösung:** Dedizierte CLI-Commands für alle Daten-Management-Operationen.

## Abhängigkeiten
- Epic 2 (observability) — Run Logger + Event Bus vorhanden ✅
- Epic 4 (tasks) — Plan Storage vorhanden ✅
- Epic 7 (memory) — Memory System vorhanden ✅

## Tasks

### Task 22.1: `runs-command` — Run History & Details

**Beschreibung:** 
CLI-Command für Run-Listing, Filtering und Detail-Anzeige. Nutzt bestehende `RunLogger` API.

**Dateien erstellt/geändert:**
- `src/cli/runs-command.ts` (Main Command Handler)
- `src/cli/run-show-command.ts` (Detail View für einzelnen Run)
- `src/cli/index.ts` (Command Registration)

**CLI-Interface:**
```bash
workbench runs [--limit 10] [--status completed|failed|running] [--since 24h|7d|30d]
workbench run show <run-id> [--format json|table]
workbench run delete <run-id> [--force]
```

**Output-Format (Table):**
```
ID                                    Status     Duration  Tokens  Started
d655302a-ded9-4ec2-839d-fa5a022aab68  completed  2.3s      1580    2026-03-09 20:30:36
1983eebd-073b-47e7-a5c2-c2867ec62634  failed     1.1s      847     2026-03-09 20:29:15
```

**Output-Format (Detail):**
```
Run: d655302a-ded9-4ec2-839d-fa5a022aab68
Status: completed
Prompt: "Create a file called test.txt with..."
Started: 2026-03-09 20:30:36 UTC
Ended: 2026-03-09 20:30:38 UTC
Duration: 2.3s

Token Usage:
  Input:  1487
  Output: 93
  Total:  1580

Tools Used:
  - write_file (1x)
  - exec (0x)

Files Modified:
  - test.txt
```

**Acceptance Criteria:**
- `workbench runs` zeigt Liste mit Filtering
- `workbench run show <id>` zeigt vollständige Details
- `workbench run delete <id>` löscht Run-Directory
- `--format json` gibt strukturiertes JSON aus
- `--since` unterstützt relative Zeitangaben (24h, 7d, 30d)
- Fehlerbehandlung für nicht-existierende IDs
- TypeScript kompiliert: `npx tsc --noEmit`
- Unit Tests für Formatierung + Filtering
- E2E Test: `workbench runs --limit 5`

**Komplexität:** M  
**Parallelisierbar:** Ja (parallel zu 22.2, 22.3)

---

### Task 22.2: `sessions-command` — Session Management

**Beschreibung:**
CLI-Command für Session-Listing und Management. Nutzt bestehende `SessionStorage` API.

**Dateien erstellt/geändert:**
- `src/cli/sessions-command.ts` (Main Command Handler)
- `src/cli/session-show-command.ts` (Detail View)
- `src/cli/index.ts` (Command Registration)

**CLI-Interface:**
```bash
workbench sessions [--limit 10] [--active]
workbench session show <session-id> [--format json]
workbench session delete <session-id> [--force]
```

**Output-Format:**
```
ID                                    Status    Messages  Last Activity
8842b817-fbf9-4dab-b44a-e9a2f630ee68  active    47        2026-03-09 20:45:12
7a2b3c4d-5e6f-7890-abcd-ef1234567890  archived  23        2026-03-08 14:22:03
```

**Acceptance Criteria:**
- `workbench sessions` zeigt Liste mit Filtering
- `workbench session show <id>` zeigt Message-History
- `workbench session delete <id>` löscht Session-Directory
- `--active` filtert nur aktive Sessions
- TypeScript kompiliert
- Unit Tests für Session-Formatierung
- E2E Test: `workbench sessions --active`

**Komplexität:** M  
**Parallelisierbar:** Ja (parallel zu 22.1, 22.3)

---

### Task 22.3: `cleanup-command` — Data Cleanup

**Beschreibung:**
CLI-Command für automatisches Löschen alter Runs/Sessions/Plans. Dry-Run-Modus für Safety.

**Dateien erstellt/geändert:**
- `src/cli/cleanup-command.ts` (Main Command Handler)
- `src/cli/index.ts` (Command Registration)
- `src/storage/cleanup.ts` (Shared Cleanup Logic)

**CLI-Interface:**
```bash
workbench cleanup --older-than 7d [--runs] [--sessions] [--plans] [--dry-run]
workbench cleanup --all [--confirm]
```

**Output-Format:**
```
[DRY RUN] Would delete 12 runs, 5 sessions, 3 plans (older than 7 days)

Runs:
  - d655302a-ded9... (2026-02-28, completed)
  - 1983eebd-073b... (2026-02-25, failed)
  ...

Sessions:
  - 8842b817-fbf9... (2026-03-01, archived)
  ...

Plans:
  - 192c8254-5b90... (2026-02-20, completed)
  ...

Total disk space: 127 MB
```

**Acceptance Criteria:**
- `--older-than` unterstützt relative Zeitangaben (1d, 7d, 30d, 1y)
- `--dry-run` zeigt Preview ohne zu löschen
- `--runs/--sessions/--plans` erlaubt selektives Cleanup
- Standardmäßig alle drei Typen (ohne Flags)
- `--confirm` erforderlich für `--all` ohne `--older-than`
- Zeigt Disk-Space-Ersparnis
- TypeScript kompiliert
- Unit Tests für Date-Parsing + Filtering
- E2E Test: `workbench cleanup --dry-run --older-than 30d`

**Komplexität:** M  
**Parallelisierbar:** Ja (parallel zu 22.1, 22.2)

---

### Task 22.4: `config-command` — Config Management

**Beschreibung:**
CLI-Command für persistente Settings (Model-Präferenzen, Defaults, API-Keys).

**Dateien erstellt/geändert:**
- `src/cli/config-command.ts` (Main Command Handler)
- `src/cli/index.ts` (Command Registration)
- `src/config/user-config.ts` (Config Storage + Validation)
- `src/types/index.ts` (UserConfig Interface)

**CLI-Interface:**
```bash
workbench config show
workbench config set default-model anthropic/claude-sonnet-4
workbench config get default-model
workbench config unset default-model
workbench config list
```

**Config-Struktur:**
```typescript
interface UserConfig {
  defaultModel?: string;
  defaultMaxSteps?: number;
  defaultReviewers?: string[];
  autoCreatePR?: boolean;
  autoSummarize?: boolean;
}
```

**Storage:** `~/.workbench/config.json` (mit File-Lock wie tokens.json)

**Acceptance Criteria:**
- `config show` zeigt alle Settings + Defaults
- `config set <key> <value>` speichert persistent
- `config get <key>` gibt einzelnen Wert aus
- `config unset <key>` löscht Setting (fällt auf Default zurück)
- Validierung für bekannte Keys (Fehler bei Tippfehler)
- TypeScript kompiliert
- Unit Tests für Config-Validation
- E2E Test: `workbench config set default-model ...`

**Komplexität:** S  
**Parallelisierbar:** Ja (parallel zu 22.1-22.3)

---

### Task 22.5: `logs-command` — Log Viewer

**Beschreibung:**
CLI-Command für Anzeige von Run-Logs ohne Dashboard. Streaming-Support für aktive Runs.

**Dateien erstellt/geändert:**
- `src/cli/logs-command.ts` (Main Command Handler)
- `src/cli/index.ts` (Command Registration)

**CLI-Interface:**
```bash
workbench logs <run-id> [--follow] [--format json|text] [--tail 100]
```

**Output-Format (Text):**
```
[2026-03-09 20:30:36] [INFO] Starting run d655302a-ded9...
[2026-03-09 20:30:36] [AGENT] Calling LLM (model: anthropic/claude-haiku-4)
[2026-03-09 20:30:37] [TOOL] write_file: test.txt
[2026-03-09 20:30:37] [TOOL] Result: success
[2026-03-09 20:30:38] [AGENT] Run completed
```

**Acceptance Criteria:**
- `workbench logs <id>` zeigt Run-Logs
- `--follow` streamt Logs in Echtzeit (für aktive Runs)
- `--format json` gibt Event-Stream aus
- `--tail N` zeigt nur letzte N Zeilen
- Fehlerbehandlung für nicht-existierende Runs
- TypeScript kompiliert
- Unit Tests für Log-Formatierung
- E2E Test: `workbench logs <id> --tail 10`

**Komplexität:** M  
**Parallelisierbar:** Ja (parallel zu 22.1-22.4)

---

### Task 22.6: `memory-command` — Memory Management

**Beschreibung:**
CLI-Command für Memory-Search und Management. Nutzt bestehende Memory-API.

**Dateien erstellt/geändert:**
- `src/cli/memory-command.ts` (Main Command Handler)
- `src/cli/index.ts` (Command Registration)

**CLI-Interface:**
```bash
workbench memory search "authentication bug" [--limit 10] [--type session|project|knowledge]
workbench memory list [--type session] [--limit 20]
workbench memory show <memory-id>
workbench memory delete <memory-id>
```

**Output-Format (Search):**
```
Results for "authentication bug":

1. [session] d655302a... (Score: 0.87)
   "In session X, we tried OAuth2 PKCE but encountered token refresh issues..."
   Created: 2026-03-08 14:22:03

2. [project] workbench (Score: 0.73)
   "Authentication system uses token storage with file locks..."
   Created: 2026-03-07 09:15:42
```

**Acceptance Criteria:**
- `memory search <query>` führt Vector-Search aus
- `memory list` zeigt alle Memories
- `memory show <id>` zeigt vollständigen Content + Metadata
- `memory delete <id>` löscht Memory-Entry
- `--type` filtert nach Memory-Type
- `--limit` begrenzt Ergebnisse
- TypeScript kompiliert
- Unit Tests für Memory-Formatierung
- E2E Test: `workbench memory search "test"`

**Komplexität:** M  
**Parallelisierbar:** Ja (parallel zu 22.1-22.5)

---

### Task 22.7: `stats-command` — Usage Statistics

**Beschreibung:**
CLI-Command für Token-Usage-Statistiken und Run-Erfolgsraten.

**Dateien erstellt/geändert:**
- `src/cli/stats-command.ts` (Main Command Handler)
- `src/cli/index.ts` (Command Registration)
- `src/storage/stats-aggregator.ts` (Aggregation Logic)

**CLI-Interface:**
```bash
workbench stats [--since 7d] [--by-model] [--by-workflow]
```

**Output-Format:**
```
Workbench Usage Statistics (Last 7 days)

Runs:
  Total: 47
  Completed: 42 (89.4%)
  Failed: 5 (10.6%)

Token Usage:
  Total: 127,483 tokens
  Input: 84,291 tokens
  Output: 43,192 tokens

By Model:
  anthropic/claude-sonnet-4: 98,234 tokens (77.1%)
  anthropic/claude-haiku-4: 29,249 tokens (22.9%)

By Workflow:
  fix-tests: 12 runs (45,892 tokens)
  review: 8 runs (31,247 tokens)
  run: 27 runs (50,344 tokens)

Average per run: 2,712 tokens
```

**Acceptance Criteria:**
- `workbench stats` zeigt Gesamt-Statistiken
- `--since` filtert Zeitraum (24h, 7d, 30d, all)
- `--by-model` gruppiert nach Model
- `--by-workflow` gruppiert nach Workflow-Type
- Zeigt Success-Rate + Token-Verteilung
- TypeScript kompiliert
- Unit Tests für Aggregation
- E2E Test: `workbench stats --since 30d`

**Komplexität:** M  
**Parallelisierbar:** Ja (parallel zu 22.1-22.6)

---

## Parallelisierungs-Plan

```
Wave 1 (parallel):
  Task 22.1 (runs-command)        ──┐
  Task 22.2 (sessions-command)    ──┤
  Task 22.3 (cleanup-command)     ──┼── Alle unabhängig
  Task 22.4 (config-command)      ──┤
  Task 22.5 (logs-command)        ──┤
  Task 22.6 (memory-command)      ──┤
  Task 22.7 (stats-command)       ──┘
```

**Alle Tasks können parallel entwickelt werden** — keine Abhängigkeiten untereinander.

## Agent-Bedarf
- **7 Worker (max parallel)** für Wave 1
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` für alle Commands
- `npm run build` erfolgreich
- `npm test` — Unit Tests grün (mindestens 1 Test pro Command)
- `npm run test:e2e` — E2E Tests grün (mindestens 1 E2E-Test pro Command)
- CLI Help-Texte für alle Commands (`workbench <command> --help`)
- README.md aktualisieren (neue Commands dokumentieren)

## Offene Fragen / Risiken
- **Config-Schema-Evolution:** UserConfig könnte in Zukunft mehr Felder bekommen → brauchen wir Schema-Versioning? **→ Entscheidung: Vorerst nein, aber Config-Validation sollte unbekannte Keys ignorieren (Forward-Compatibility)**
- **Log-Streaming-Performance:** Bei sehr langen Runs könnte `--follow` Performance-Issues haben → **Mitigation: Event-Batching + Debouncing**
- **Memory-Search-Relevanz:** Vector-Search könnte irrelevante Ergebnisse liefern → **Mitigation: Score-Threshold (0.5) + Limit (default 10)**
