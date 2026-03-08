# Epic 13: e2e-dashboard — E2E Dashboard Tests

## Ziel
Dashboard REST API, WebSocket Events und Frontend-Komponenten testen. Kann parallel zu Epic 11 entwickelt werden.

## Abhängigkeiten
Epic 10 (e2e-test-infra) — Infrastruktur

## Tasks

### Task 13.1: `api-endpoints` — REST API Tests

**Beschreibung:** Dashboard API Endpoints mit Fastify `inject()` testen (kein HTTP nötig). Sessions, Runs, Stats Endpoints.

**Dateien erstellt/geändert:**
- `src/test/e2e/dashboard/api-endpoints.test.ts`

**Acceptance Criteria:**
- GET `/api/sessions` → 200, Array
- GET `/api/runs` → 200, Array
- GET `/api/stats` → 200, Object mit Token-Stats
- 404 für unbekannte Routes
- Korrekte Content-Type Header
- Kein `/api/api/` Doppel-Prefix (Regression PR #14)

**Komplexität:** M
**Parallelisierbar:** Nein (zuerst — etabliert API-Verständnis)

### Task 13.2: `websocket-events` — WebSocket Event Bridge

**Beschreibung:** WebSocket-Verbindung aufbauen, Events empfangen. Event-Bus → WebSocket Bridge testen.

**Dateien erstellt/geändert:**
- `src/test/e2e/dashboard/websocket-events.test.ts`

**Acceptance Criteria:**
- WebSocket-Verbindung herstellbar
- Event auf Event-Bus → erscheint als WebSocket-Message
- Korrekte Event-Struktur (type, payload, timestamp)
- Mehrere Clients empfangen Events gleichzeitig
- Disconnect/Reconnect sauber

**Komplexität:** M
**Parallelisierbar:** Ja (nach 13.1, parallel zu 13.3)

### Task 13.3: `frontend-components` — React Component Tests

**Beschreibung:** Kern-React-Komponenten mit @testing-library/react testen. Nutzt jsdom (bereits als devDep).

**Dateien erstellt/geändert:**
- `src/test/e2e/dashboard/frontend-components.test.ts`

**Acceptance Criteria:**
- Session-Liste rendert mit Mock-Daten
- Run-Detail-View zeigt Messages und Tool Calls
- Token-Stats-Display zeigt Zahlen
- Loading/Error States funktionieren
- Kein Browser nötig (jsdom reicht)

**Komplexität:** M
**Parallelisierbar:** Ja (nach 13.1, parallel zu 13.2)

## Parallelisierungs-Plan
```
Task 13.1 (api-endpoints)           ──── sequentiell (zuerst)
    │
    ├── Task 13.2 (websocket)       ──── parallel
    └── Task 13.3 (frontend)        ──── parallel
```

## Agent-Bedarf
- **2 Worker** (parallel in Wave 2)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm test` + `npm run test:e2e`
- API-Endpoints, WebSocket-Events und Kern-Frontend-Komponenten getestet
