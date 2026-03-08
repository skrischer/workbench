# Epic 19: dashboard-maturity — Dashboard API & UI Skalierung

## Ziel
Dashboard für reale Nutzung skalierbar machen. Aktuell gibt es keine Pagination (alle Runs/Plans/Sessions werden komplett geladen), keine Authentifizierung für WebSocket-Verbindungen (jeder im Netzwerk kann Events mitlesen), und keine Metrics für Monitoring. Diese drei Punkte werden mit steigender Nutzung zu Problemen.

## Abhängigkeiten
- Epic 5A (Dashboard Backend) — REST API, WebSocket
- Epic 5B (Dashboard Frontend) — React SPA
- Epic 2 (Observability) — Event Bus

## Tasks

### Task 19.1: `api-pagination` — Pagination für Listen-Endpoints

**Beschreibung:** Query-Parameter `?limit=` und `?offset=` für alle Listen-Endpoints (`/api/runs`, `/api/plans`, `/api/sessions`). Antwort enthält `total` Count für Frontend-Pagination.

**Dateien erstellt/geändert:**
- `src/dashboard/routes/runs.ts` (Pagination-Parameter)
- `src/dashboard/routes/plans.ts` (Pagination-Parameter)
- `src/dashboard/routes/sessions.ts` (Pagination-Parameter)
- `src/storage/session-storage.ts` (list() mit offset/limit)
- `src/storage/run-logger.ts` (list() mit offset/limit)
- `src/task/plan-storage.ts` (list() mit offset/limit)
- `src/dashboard/__tests__/pagination.test.ts` (neu)
- `src/dashboard/ui/src/hooks/useApi.ts` (Pagination-Support)

**Acceptance Criteria:**
- `GET /api/runs?limit=10&offset=0` → `{ data: [...], total: 42, limit: 10, offset: 0 }`
- Default: `limit=50, offset=0`
- `limit` max 100 (Server-Side Cap)
- Sorting: neueste zuerst (createdAt desc) als Default
- Optional: `?status=completed` Filter (bonus, nicht required)
- Frontend `useApi` Hook unterstützt Pagination-Parameter
- Bestehende API-Tests bleiben grün (ohne Query-Params → Default-Verhalten)
- Mindestens 8 Tests: Default pagination, custom limit/offset, total count, limit cap, empty results
- `npx tsc --noEmit` + `npm run test` + `npm run test:e2e` grün

**Komplexität:** M  
**Parallelisierbar:** Ja

### Task 19.2: `websocket-auth` — Token-basierte WebSocket-Authentifizierung

**Beschreibung:** WebSocket-Verbindungen mit einem einfachen Token absichern. Aktuell kann jeder im Netzwerk eine WS-Verbindung öffnen und alle Events mitlesen. Für Tailscale-Zugang relevant.

**Dateien erstellt/geändert:**
- `src/dashboard/ws-bridge.ts` (Token-Check bei Connection)
- `src/dashboard/config.ts` (wsToken Config-Option)
- `src/dashboard/__tests__/ws-auth.test.ts` (neu)
- `src/dashboard/ui/src/hooks/useWebSocket.ts` (Token im Connection-URL)

**Acceptance Criteria:**
- Config: `wsToken: string | null` — wenn gesetzt, müssen Clients Token mitschicken
- Client sendet Token als Query-Parameter: `ws://host:port/ws?token=XYZ`
- Ungültiges/fehlendes Token → Connection rejected (WebSocket close mit Code 4401)
- Wenn `wsToken: null` → keine Auth (Rückwärtskompatibel)
- Token aus Environment: `WORKBENCH_WS_TOKEN` oder Config-File
- Frontend `useWebSocket` Hook liest Token aus Config/Environment
- Mindestens 6 Tests: valid token, invalid token, missing token, no auth configured
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S  
**Parallelisierbar:** Ja

### Task 19.3: `metrics-endpoint` — /metrics für Monitoring

**Beschreibung:** Prometheus-kompatibles `/metrics` Endpoint für externe Monitoring-Integration. Exportiert Runtime-Metriken (aktive Runs, Token-Verbrauch, WebSocket-Connections, Uptime).

**Dateien erstellt/geändert:**
- `src/dashboard/routes/metrics.ts` (neu)
- `src/dashboard/routes/index.ts` (Route registrieren)
- `src/dashboard/__tests__/metrics.test.ts` (neu)

**Acceptance Criteria:**
- `GET /metrics` → Prometheus Text Format (Content-Type: text/plain)
- Exportierte Metriken:
  - `workbench_runs_total{status="completed|failed|running"}` (Counter)
  - `workbench_sessions_total` (Counter)
  - `workbench_tokens_used_total` (Counter)
  - `workbench_ws_connections_active` (Gauge)
  - `workbench_uptime_seconds` (Gauge)
- Kein externer Prometheus-Client nötig — einfache String-Formatierung reicht für v1
- Mindestens 5 Tests: Format-Validierung, Metriken vorhanden, Werte korrekt
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S  
**Parallelisierbar:** Ja

## Parallelisierungs-Plan

```
Wave 1 (parallel — alle unabhängig):
  Task 19.1 (api-pagination)     ──┐
  Task 19.2 (websocket-auth)     ──┤
  Task 19.3 (metrics-endpoint)   ──┘
```

## Agent-Bedarf
- **3 Worker** (max parallel)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test` + `npm run test:e2e`
- Mindestens 19 neue Tests (8 + 6 + 5)
- Bestehende Tests bleiben grün
- Rückwärtskompatibel (kein Auth-Token → kein Auth, keine Query-Params → Default-Pagination)

## Offene Fragen / Risiken
- **Pagination + JSON Storage:** Aktuell liest `list()` alle Files und gibt alle zurück. Pagination erfordert: alle laden, sortieren, slicen. Bei >1000 Runs wird das langsam → SQLite-Migration (bereits auf der Roadmap) löst das langfristig.
- **WS-Token Rotation:** Einfaches statisches Token für v1. Token-Rotation oder JWT wäre Follow-up.
- **Metrics Granularity:** v1 nur Basis-Metriken. Histogramme (Request-Latency, Tool-Duration) als Follow-up.
