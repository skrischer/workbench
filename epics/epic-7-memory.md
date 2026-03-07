# Epic 7: memory — Memory System (LanceDB)

## Ziel
Langfristiges Projektwissen speichern und abrufen: Session-Summaries, Projekt-Konventionen, gelerntes Wissen. Vektorbasierte Suche via LanceDB embedded.

## Abhängigkeiten
- Epic 1C (runtime-cli) — Agent Runtime Loop, Session-Storage

## Tasks

### Task 7.1: `memory-types` — Memory Type-Definitionen + Tests

**Beschreibung:** Types für Memory-Einträge: verschiedene Memory-Typen, Metadata, Embedding-Interface.

**Dateien erstellt/geändert:**
- `src/types/memory.ts` (MemoryEntry, MemoryType, MemoryQuery, MemoryResult, EmbeddingConfig)
- `src/memory/validation.ts` (validateMemoryEntry, validateQuery)
- `src/memory/__tests__/validation.test.ts` (mind. 6 Tests)
- `src/memory/index.ts` (Barrel-Export)

**Type-Definitionen:**
```typescript
type MemoryType = 'session' | 'project' | 'knowledge' | 'preference';

interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  summary?: string;
  tags: string[];
  source: {
    type: 'session' | 'manual' | 'auto';
    sessionId?: string;
    runId?: string;
  };
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

interface MemoryQuery {
  text: string;
  type?: MemoryType;
  tags?: string[];
  limit?: number;           // Default: 5
  minScore?: number;        // 0-1
}

interface MemoryResult {
  entry: MemoryEntry;
  score: number;
}
```

**Acceptance Criteria:**
- Alle Types exportiert und importierbar
- Validierung: content nicht leer, gültiger MemoryType, Tags als String-Array
- Query-Validierung: text nicht leer, limit > 0, minScore 0-1
- Tests: gültige Entries, fehlende Felder, ungültiger Type, Query-Validierung
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S
**Parallelisierbar:** Nein (muss zuerst)

### Task 7.2: `lancedb-store` — LanceDB Integration + Embedding + Tests

**Beschreibung:** LanceDB als embedded Vector-DB. CRUD + Vektor-Suche.

**Dateien erstellt/geändert:**
- `src/memory/lancedb-store.ts` (LanceDBMemoryStore: init, add, search, get, update, delete, listByType)
- `src/memory/embeddings.ts` (EmbeddingProvider: generateEmbedding)
- `src/memory/__tests__/lancedb-store.test.ts` (mind. 8 Tests)
- `src/memory/index.ts` (Barrel-Export)

**LanceDB-Schema:**
```typescript
{
  id: string,
  type: string,
  content: string,
  summary: string,
  tags: string,          // JSON-serialisiert
  source: string,        // JSON-serialisiert
  metadata: string,      // JSON-serialisiert
  createdAt: string,
  updatedAt: string,
  vector: Float32Array   // Embedding
}
```

**Acceptance Criteria:**
- `init()` erstellt/öffnet LanceDB-Datenbank + Tabelle
- `add(entry)` generiert Embedding, speichert Entry
- `search(query)` Vektor-Suche, sortierte Results
- `get(id)`, `update(id, partial)`, `delete(id)`, `listByType(type)`
- Update re-embedded bei Content-Change
- DB-Pfad konfigurierbar (default: `~/.workbench/memory/`)
- Tests: CRUD-Roundtrip, Vektor-Suche, Type-Filter, Update + Re-Embed
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** L
**Parallelisierbar:** Ja (nach 7.1, parallel zu 7.3)

### Task 7.3: `session-summarizer` — Automatische Session-Summaries + Tests

**Beschreibung:** Nach jedem Run automatisch Summary generieren und als Memory speichern.

**Dateien erstellt/geändert:**
- `src/memory/session-summarizer.ts` (SessionSummarizer: summarize(sessionId) → MemoryEntry)
- `src/memory/summary-prompt.ts` (System-Prompt für Summary-Generierung)
- `src/memory/__tests__/session-summarizer.test.ts` (mind. 5 Tests mit Mock-LLM)
- `src/memory/index.ts` (Barrel-Export)

**Summary enthält:**
- Was wurde gemacht (1-3 Sätze)
- Welche Dateien geändert
- Welche Tools am meisten genutzt
- Gelerntes / Entscheidungen
- Auto-generierte Tags

**Acceptance Criteria:**
- `summarize(sessionId)` lädt Session, generiert Summary via LLM
- Summary als MemoryEntry mit type `session`
- Tags automatisch aus Summary extrahiert
- Fallback-Summary bei LLM-Fehler (aus Message-Metadata)
- Tests: Erfolgreiche Summary (Mock), Tag-Extraktion, Fallback
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 7.1, parallel zu 7.2)

### Task 7.4: `memory-tools` — remember + recall Tools + Integration + Tests

**Beschreibung:** Zwei neue Tools + Auto-Summary-Integration nach Runs.

**Dateien erstellt/geändert:**
- `src/tools/remember.ts` (RememberTool: content, type?, tags?)
- `src/tools/recall.ts` (RecallTool: query, type?, limit?)
- `src/tools/__tests__/memory-tools.test.ts` (mind. 6 Tests)
- `src/tools/defaults.ts` (2 neue Tools registrieren)
- `src/runtime/agent-loop.ts` (Post-Run Hook für Auto-Summary)

**Acceptance Criteria:**
- `remember` speichert Content als MemoryEntry
- `recall` sucht via MemoryStore, gibt formatierte Ergebnisse
- Auto-Summary: nach `run:end` Event (optional, konfigurierbar)
- Tests: Remember+Recall Roundtrip, Auto-Summary-Trigger, leere Suche, Type-Filter
- `npx tsc --noEmit` + `npm run build` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Nein (nach 7.2 + 7.3)

## Parallelisierungs-Plan
```
Wave 1 (sequentiell):
  Task 7.1 (memory-types)       ──

Wave 2 (parallel):
  Task 7.2 (lancedb-store)      ──┐
  Task 7.3 (session-summarizer) ──┘

Wave 3 (sequentiell):
  Task 7.4 (memory-tools)       ──
```

## Agent-Bedarf
- **2 Worker** (parallel in Wave 2)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test`
- LanceDB als Dependency in package.json
- Event-Map erweitern: `memory:added`, `memory:searched`, `memory:summarized`

## Offene Fragen / Risiken
- **Embedding-Provider:** Empfehlung: lokales Modell (`@xenova/transformers`) für Offline-Fähigkeit + keine API-Kosten. Entscheidung in Task 7.2.
- **LanceDB Version:** `@lancedb/lancedb` — native Bindings. Build-Kompatibilität prüfen.
- **Memory-Größe:** Kein Pruning in Phase 1. Cleanup-Strategie als Future-Work.
- **Summary-Qualität:** System-Prompt muss gut strukturiert sein. Kurze Sessions (< 3 Messages) evtl. keine Summary.
