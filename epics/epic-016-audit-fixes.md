# Epic 16: audit-fixes — Code-Quality Fixes aus dem Audit

## Ziel
Kleinere aber wichtige Fixes aus dem Epic-Audit zusammengefasst: TypeScript-Compile-Fehler im Frontend, fehlende Memory-Events im EventBus, 404-Error-Handling via Error Types statt String-Match, und der fehlende `/api/stats` Endpoint. Alles P1/P2-Gaps die einzeln klein sind aber zusammen die Code-Qualität signifikant verbessern.

## Abhängigkeiten
- Epic 5A (Dashboard Backend) — 404 Error Types, /api/stats
- Epic 5B (Dashboard Frontend) — TSC-Fix
- Epic 7 (Memory System) — Events
- Epic 2 (Observability) — EventMap erweitern

## Tasks

### Task 16.1: `fix-frontend-tsc` — TypeScript-Fehler in integration.test.tsx fixen

**Beschreibung:** Import-Pfade korrigieren und unused Imports entfernen in `src/dashboard/ui/src/__tests__/integration.test.tsx`.

**Dateien erstellt/geändert:**
- `src/dashboard/ui/src/__tests__/integration.test.tsx` (Import-Pfade fixen)

**Acceptance Criteria:**
- `../../../types/run.js` → `../../../../types/run.js` (korrekter relativer Pfad)
- `../../../types/task.js` → `../../../../types/task.js`
- Unused imports (`React`, `within`) entfernen
- `npx tsc --noEmit` in `src/dashboard/ui/` kompiliert fehlerfrei
- Bestehende Frontend-Tests bleiben grün

**Komplexität:** S (15 Minuten)  
**Parallelisierbar:** Ja

### Task 16.2: `memory-events` — Memory-Events in EventMap ergänzen

**Beschreibung:** Memory-Events in die zentrale EventMap eintragen und in den Memory-Operationen emittieren. Aktuell fehlen diese Events komplett — ein DoD-Gap aus Epic 7.

**Dateien erstellt/geändert:**
- `src/types/events.ts` (3 neue Event-Typen)
- `src/memory/lancedb-store.ts` (Events emittieren bei add/search)
- `src/memory/session-summarizer.ts` (Event emittieren nach Summary)
- `src/memory/__tests__/memory-events.test.ts` (neu)

**Acceptance Criteria:**
- EventMap erweitert um:
  - `memory:added` — `{ id: string; type: MemoryType; tags: string[] }`
  - `memory:searched` — `{ query: string; resultCount: number }`
  - `memory:summarized` — `{ sessionId: string; summaryId: string; messageCount: number }`
- Events werden bei den entsprechenden Operationen emittiert
- EventBus muss optional injiziert werden (nicht alle Codepfade haben einen Bus)
- Mindestens 5 Tests: Event wird emittiert bei add, search, summarize; kein Crash ohne EventBus
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S  
**Parallelisierbar:** Ja

### Task 16.3: `error-types` — NotFoundError statt String-Match für 404s

**Beschreibung:** Dedizierte `NotFoundError` Klasse einführen und in Storage-Modulen verwenden. Dashboard-Routes prüfen dann `instanceof NotFoundError` statt `err.message.includes('not found')`.

**Dateien erstellt/geändert:**
- `src/types/errors.ts` (neu — NotFoundError, StorageError)
- `src/types/index.ts` (Export erweitern)
- `src/storage/session-storage.ts` (NotFoundError werfen)
- `src/storage/run-logger.ts` (NotFoundError werfen)
- `src/task/plan-storage.ts` (NotFoundError werfen)
- `src/dashboard/routes/sessions.ts` (instanceof statt string match)
- `src/dashboard/routes/runs.ts` (instanceof statt string match)
- `src/dashboard/routes/plans.ts` (instanceof statt string match)
- `src/types/__tests__/errors.test.ts` (neu)

**Acceptance Criteria:**
- `NotFoundError extends Error` mit `resource` und `id` Properties
- Storage-Module werfen `NotFoundError` bei nicht gefundenen Entities
- Dashboard-Routes nutzen `instanceof NotFoundError` für 404-Responses
- Bestehende API-Tests bleiben grün (Verhalten ändert sich nicht, nur interne Mechanik)
- Mindestens 4 Tests: Error Properties, instanceof check, Error message format
- `npx tsc --noEmit` + `npm run test` + `npm run test:e2e` grün

**Komplexität:** M  
**Parallelisierbar:** Ja (nach Task 16.1 nicht nötig)

### Task 16.4: `api-stats-endpoint` — /api/stats Endpoint implementieren

**Beschreibung:** REST-Endpoint `GET /api/stats` für aggregierte Statistiken (Token-Usage, Run-Counts, Plan-Counts). Im Audit als fehlend identifiziert (Epic 13 AC).

**Dateien erstellt/geändert:**
- `src/dashboard/routes/stats.ts` (neu)
- `src/dashboard/routes/index.ts` (Route registrieren)
- `src/dashboard/__tests__/stats.test.ts` (neu)
- `src/test/e2e/dashboard/api-endpoints.test.ts` (Test für /api/stats hinzufügen)

**Acceptance Criteria:**
- `GET /api/stats` → 200, JSON mit:
  - `totalRuns: number`
  - `totalPlans: number`
  - `totalSessions: number`
  - `tokenUsage: { total: number, byModel: Record<string, number> }` (soweit aus Run-Logs ableitbar)
- Mindestens 3 Tests: Stats mit Daten, Stats ohne Daten (leeres System), Response-Schema
- E2E-Test in api-endpoints.test.ts ergänzt
- `npx tsc --noEmit` + `npm run test` + `npm run test:e2e` grün

**Komplexität:** M  
**Parallelisierbar:** Ja (parallel zu 16.1-16.3)

## Parallelisierungs-Plan

```
Wave 1 (parallel — alle unabhängig):
  Task 16.1 (fix-frontend-tsc)    ──┐
  Task 16.2 (memory-events)       ──┤
  Task 16.3 (error-types)         ──┤
  Task 16.4 (api-stats-endpoint)  ──┘
```

## Agent-Bedarf
- **4 Worker** (max parallel in Wave 1)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test` + `npm run test:e2e`
- Alle bestehenden 562+ Tests bleiben grün
- Mindestens 17 neue Tests (0 + 5 + 4 + 3 + E2E)
- Frontend kompiliert fehlerfrei
- Memory-Events in EventMap
- Keine String-basierte 404-Detection mehr

## Offene Fragen / Risiken
- **Token-Usage Aggregation:** `/api/stats` muss Run-Logs lesen und Token-Usage summieren. Bei vielen Runs könnte das langsam werden. Mitigation: Caching oder lazy aggregation.
- **Error-Type Migration:** Alle bestehenden Catch-Blöcke müssen geprüft werden — Storage-Module werfen jetzt `NotFoundError` statt generische Errors. E2E-Tests sollten das auffangen.
