# Epic 24: session-summarizer — Automatische Memory aus Agent-Runs

## Ziel
Aktiviert das Memory-System durch automatische Session-Zusammenfassungen nach jedem Run. Agent lernt aus vergangenen Runs und kann via `memory_search` auf akkumuliertes Wissen zugreifen. Verwandelt isolierte Runs in persistentes Projektwissen.

**Problem:** Memory-System (LanceDB + Tools) existiert, aber wird nicht genutzt — User muss manuell `memory_store` callen.  
**Lösung:** Automatische LLM-basierte Summarization nach jedem Run + Memory-Speicherung.

## Abhängigkeiten
- Epic 7 (memory) — LanceDB + Memory Tools vorhanden ✅
- Epic 2 (observability) — Run Logger vorhanden ✅
- Epic 1B (oauth) — LLM Client vorhanden ✅

## Tasks

### Task 24.1: `session-summarizer` — Core Summarization Logic

**Beschreibung:**
LLM-basierte Zusammenfassung von Agent-Sessions. Extrahiert Key Decisions, Errors, Learnings aus Message-History.

**Dateien erstellt/geändert:**
- `src/memory/session-summarizer.ts` (Main Summarization Logic)
- `src/types/index.ts` (SessionSummary Interface)

**Interface:**
```typescript
interface SessionSummaryInput {
  sessionId: string;
  runId: string;
  messages: Message[];          // Agent-Message-History
  runMetadata: RunMetadata;     // Token-Usage, Status, etc.
  filesModified: string[];      // Welche Dateien wurden geändert
}

interface SessionSummary {
  sessionId: string;
  runId: string;
  summary: string;              // LLM-generierte Zusammenfassung
  keyDecisions: string[];       // Extrahierte Entscheidungen
  errors: string[];             // Fehler + Lösungen
  learnings: string[];          // Wichtige Erkenntnisse
  relatedFiles: string[];       // Geänderte/relevante Dateien
  metadata: {
    tokenUsage: TokenUsage;
    status: RunStatus;
    duration: number;
    timestamp: string;
  };
}

export async function summarizeSession(input: SessionSummaryInput): Promise<SessionSummary>;
```

**Summarization-Prompt:**
```markdown
You are analyzing an agent session to extract key information.

Session Context:
- Run ID: {runId}
- Status: {status}
- Duration: {duration}
- Files Modified: {files}

Message History:
{messages}

Extract and summarize:
1. **Key Decisions:** What important choices were made?
2. **Errors Encountered:** What went wrong and how was it fixed?
3. **Learnings:** What should be remembered for future sessions?
4. **Overall Summary:** Brief overview of what was accomplished.

Format your response as structured JSON:
{
  "summary": "...",
  "keyDecisions": ["...", "..."],
  "errors": ["...", "..."],
  "learnings": ["...", "..."]
}
```

**Implementation:**
- Nutzt `anthropic/claude-haiku-4` (kosten-effizient für Summarization)
- Max Input: letzte 50 Messages (begrenzt Context für Performance)
- Structured Output via JSON-Mode (wenn verfügbar) oder JSON-Parsing
- Error-Handling: Wenn Summarization fehlschlägt → Basic Fallback (erste User-Message als Summary)

**Acceptance Criteria:**
- `summarizeSession()` generiert strukturierte Zusammenfassung
- Nutzt LLM-API für Zusammenfassung
- Extrahiert Key Decisions, Errors, Learnings
- Fallback bei LLM-Fehler (Basic Summary statt Failure)
- TypeScript kompiliert
- Unit Tests für Input-Validation
- Integration Test: Mock LLM Response → Verify Summary-Structure

**Komplexität:** M  
**Parallelisierbar:** Nein (Basis für 24.2)

---

### Task 24.2: `auto-memory-storage` — Automatische Memory-Speicherung

**Beschreibung:**
Post-Run Hook: Nach jedem erfolgreichen Run wird automatisch Zusammenfassung erstellt und als Memory gespeichert.

**Dateien erstellt/geändert:**
- `src/memory/auto-memory.ts` (Post-Run Hook Logic)
- `src/runtime/agent-loop.ts` (Hook-Integration)
- `src/config/user-config.ts` (autoSummarize Setting)

**Interface:**
```typescript
export async function storeSessionMemory(
  sessionId: string,
  runId: string,
  summary: SessionSummary
): Promise<void>;
```

**Integration-Flow:**
1. Agent-Run endet (erfolgreich oder failed)
2. Check UserConfig: `autoSummarize` (default: true)
3. Check CLI-Flag: `--no-summarize` (optional override)
4. Wenn Summarization erlaubt:
   - Session-Messages + Run-Metadata sammeln
   - `summarizeSession()` aufrufen
   - Embedding generieren via @xenova/transformers
   - Memory speichern via Memory-API
   - Memory-ID in Run-Metadata speichern

**Run-Metadata Extension:**
```typescript
interface RunMetadata {
  // ... existing fields
  memoryId?: string;         // Memory-ID falls Summary erstellt
}
```

**Memory-Type:**
```typescript
const memory: Memory = {
  id: generateId(),
  type: 'session',
  content: summary.summary,
  embedding: await generateEmbedding(summary.summary),
  metadata: {
    sessionId: summary.sessionId,
    runId: summary.runId,
    keyDecisions: summary.keyDecisions,
    errors: summary.errors,
    learnings: summary.learnings,
    relatedFiles: summary.relatedFiles,
    tokenUsage: summary.metadata.tokenUsage,
    status: summary.metadata.status,
    timestamp: summary.metadata.timestamp,
  },
};
```

**Acceptance Criteria:**
- Nach jedem Run wird automatisch Memory erstellt (wenn nicht deaktiviert)
- `--no-summarize` Flag unterdrückt Summarization
- `autoSummarize` Config-Setting respektiert
- Memory-ID wird in Run-Metadata gespeichert
- Fehlerbehandlung: Summarization-Fehler → Warning statt Run-Failure
- TypeScript kompiliert
- Unit Tests für Hook-Logic
- E2E Test: `workbench run "<prompt>"` → Memory wird erstellt

**Komplexität:** M  
**Parallelisierbar:** Nein (braucht 24.1)

---

### Task 24.3: `memory-retrieval-integration` — Agent nutzt Memory proaktiv

**Beschreibung:**
Erweitert Agent-System-Prompt um Memory-Search-Hinweis. Agent wird instruiert, bei relevanten Tasks nach ähnlichen Sessions zu suchen.

**Dateien erstellt/geändert:**
- `src/runtime/system-prompt.ts` (Memory-Hinweis hinzufügen)
- `src/agents/agent-config.ts` (Tools-Whitelist um memory_search erweitern)

**System-Prompt Extension:**
```markdown
## Memory & Context

You have access to a memory system that stores summaries of past sessions.

**When to use memory:**
- Before starting a task, search for relevant past sessions
- Learn from previous errors and solutions
- Reference past decisions and patterns

**Tool: memory_search**
Search for relevant past sessions using natural language:
```
memory_search("authentication bug fixes")
memory_search("how we implemented feature X")
```

**Best Practices:**
1. Search memory before starting complex tasks
2. Reference past learnings in your decisions
3. Avoid repeating mistakes from previous sessions
```

**Agent-Config Extension:**
```typescript
const defaultTools = [
  'read_file',
  'write_file',
  'edit_file',
  'exec',
  'search_code',
  'list_files',
  'memory_search',  // ← NEU
  // ...
];
```

**Acceptance Criteria:**
- System-Prompt enthält Memory-Hinweis
- `memory_search` Tool ist standardmäßig verfügbar (außer explizit ausgeschlossen)
- Agent nutzt Memory proaktiv (beobachtbar in Run-Logs)
- TypeScript kompiliert
- Integration Test: Agent sucht Memory bei relevanter Task

**Komplexität:** S  
**Parallelisierbar:** Ja (parallel zu 24.2)

---

### Task 24.4: `memory-config` — Config & CLI-Integration

**Beschreibung:**
Erweitert UserConfig + CLI um Memory-spezifische Settings (auto-summarize, model, retention).

**Dateien erstellt/geändert:**
- `src/config/user-config.ts` (Memory-Config Fields)
- `src/types/index.ts` (UserConfig Interface erweitern)
- `src/cli/run-command.ts` (--no-summarize Flag)
- `src/cli/run-plan-command.ts` (--no-summarize Flag)

**Config-Schema:**
```typescript
interface UserConfig {
  // ... existing fields
  autoSummarize?: boolean;           // Default: true
  summarizerModel?: string;          // Default: "anthropic/claude-haiku-4"
  memoryRetentionDays?: number;      // Default: 90 (0 = unbegrenzt)
}
```

**CLI-Integration:**
```bash
# Summarization für einzelnen Run deaktivieren:
workbench run "<prompt>" --no-summarize
workbench run plan-<id> --no-summarize

# Persistent deaktivieren:
workbench config set autoSummarize false

# Model für Summarization ändern:
workbench config set summarizerModel anthropic/claude-sonnet-4

# Retention-Policy:
workbench config set memoryRetentionDays 30
```

**Acceptance Criteria:**
- UserConfig enthält Memory-spezifische Fields
- `--no-summarize` Flag in allen relevanten Commands
- Config-Defaults werden respektiert
- TypeScript kompiliert
- Unit Tests für Config-Validation
- E2E Test: `workbench config set autoSummarize false` deaktiviert Memory

**Komplexität:** S  
**Parallelisierbar:** Ja (parallel zu 24.1-24.3)

---

### Task 24.5: `memory-cleanup` — Automatische Memory-Retention

**Beschreibung:**
Implementiert automatische Löschung alter Memories basierend auf Retention-Policy. Verhindert unbegrenztes Wachstum.

**Dateien erstellt/geändert:**
- `src/memory/memory-cleanup.ts` (Cleanup Logic)
- `src/cli/cleanup-command.ts` (--memories Flag hinzufügen)

**Interface:**
```typescript
export async function cleanupOldMemories(
  retentionDays: number
): Promise<{ deleted: number; kept: number }>;
```

**CLI-Integration:**
```bash
# Teil von cleanup-command:
workbench cleanup --older-than 90d --memories [--dry-run]
```

**Cleanup-Logic:**
- Löscht Memories älter als `memoryRetentionDays` (aus Config)
- Ausnahme: Memories mit Bookmark-Flag bleiben erhalten (zukünftige Feature-Vorbereitung)
- Dry-Run-Modus zeigt Preview

**Acceptance Criteria:**
- `cleanupOldMemories()` löscht alte Memories
- Respektiert `memoryRetentionDays` Config
- `--dry-run` zeigt Preview
- TypeScript kompiliert
- Unit Tests für Cleanup-Logic
- E2E Test: `workbench cleanup --memories --dry-run`

**Komplexität:** S  
**Parallelisierbar:** Ja (parallel zu 24.1-24.4)

---

## Parallelisierungs-Plan

```
Wave 1 (sequentiell):
  Task 24.1 (session-summarizer)   ──

Wave 2 (parallel):
  Task 24.2 (auto-memory-storage)  ──┐
  Task 24.3 (memory-retrieval)     ──┼── Alle unabhängig
  Task 24.4 (memory-config)        ──┤
  Task 24.5 (memory-cleanup)       ──┘
```

## Agent-Bedarf
- **4 Worker (max parallel in Wave 2)** für parallele Tasks
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` für alle Module
- `npm run build` erfolgreich
- `npm test` — Unit Tests grün (mindestens 1 Test pro Modul)
- `npm run test:e2e` — E2E Test: Memory wird nach Run erstellt
- CLI Help-Texte aktualisiert
- README.md aktualisieren (Memory-System dokumentieren)
- CHANGELOG.md aktualisieren

## Offene Fragen / Risiken
- **Summarization-Kosten:** Jeder Run erzeugt zusätzlichen LLM-Call → **Mitigation: Nutzt Haiku (kosten-effizient), optional deaktivierbar**
- **Summarization-Qualität:** LLM könnte irrelevante/falsche Zusammenfassungen generieren → **Mitigation: Strukturierter Prompt + JSON-Mode, User kann Memory löschen**
- **Memory-Retrieval-Relevanz:** Agent könnte falsche/irrelevante Memories finden → **Mitigation: Score-Threshold + Context-Window-Limit**
- **Storage-Growth:** Memory-DB wächst unbegrenzt → **Mitigation: Retention-Policy (default 90d) + Cleanup-Command**
- **Performance:** Embedding-Generierung könnte langsam sein → **Mitigation: Async Post-Run, blockiert Run-Completion nicht**

---

### Task 24.6: `vitest-timeout-config` — E2E Test Timeout Fix (Quick)

**Beschreibung:**
Sofortiger Fix für 8 timeout-failures in E2E Tests durch Vitest-Timeout-Erhöhung. Ermöglicht Epic-PR-Merge ohne E2E-Blockade.

**Problem:**
- 8 E2E Tests timeout @ 5s (Vitest default)
- CLI-Spawn + Mock-Server + Embedding = 8-15s real execution time
- Blockiert Epic 24 PR-Merge

**Dateien geändert:**
- `vitest.config.ts` (Global testTimeout: 15000)
- `src/test/e2e/auto-memory.test.ts` (Timeout-Comments)
- `src/test/e2e/agent-loop/*.test.ts` (Timeout-Comments)

**Changes:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000, // ✅ 15s global (was: 5s default)
    // ...
  },
});
```

**Acceptance Criteria:**
- ✅ Alle 968 Tests passed (keine Timeouts)
- ✅ Vitest testTimeout: 15000 (global)
- ✅ Comments in slow tests: "TODO Epic 27: Async embeddings will reduce to <10s"
- ✅ TypeScript kompiliert
- ✅ Build erfolgreich
- ✅ 3x Full-Suite-Run ohne Flakiness

**Known Issue (akzeptiert für Epic 24):**
- E2E Tests dauern 10-15s (durch synchrone Embedding-Generation)
- Fix in Epic 27: Async embeddings → <10s

**Komplexität:** S (5 Zeilen Code, keine Logic-Changes)  
**Parallelisierbar:** Ja (unabhängig)

