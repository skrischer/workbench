# Epic 5A: dashboard-be — Fastify Server + WebSocket Bridge

## Ziel
HTTP-Server mit Fastify aufsetzen, der REST-Endpoints für historische Daten (Runs, Plans, Sessions) und eine WebSocket-Bridge bereitstellt, die alle Event-Bus-Events live an verbundene Clients streamt.

## Abhängigkeiten
- Epic 2 (observability) — Event Bus, RunLogger, TokenTracker existieren
- Epic 4 (task-system) — Plan-Storage für Plan-Endpoints

## Tasks

### Task 5A.1: `fastify-server` — Server-Skeleton + Health-Endpoint + Tests

**Beschreibung:** Fastify-Server mit Plugin-Architektur aufsetzen. CORS, Health-Check, graceful Shutdown. Konfigurierbar (Port, Host).

**Dateien erstellt/geändert:**
- `src/dashboard/server.ts` (createServer: Fastify-Instanz mit Plugins, start/stop)
- `src/dashboard/config.ts` (DashboardConfig: port, host, corsOrigin)
- `src/dashboard/__tests__/server.test.ts` (mind. 5 Tests)
- `src/dashboard/index.ts` (Barrel-Export)

**Acceptance Criteria:**
- `createServer(config)` gibt konfigurierte Fastify-Instanz zurück
- CORS aktiviert (default: `*`, konfigurierbar)
- `GET /health` gibt `{ status: "ok", uptime, version }` zurück
- Graceful Shutdown (SIGINT/SIGTERM)
- Tests: Health-Endpoint, Config-Defaults, Server-Start/Stop
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S
**Parallelisierbar:** Nein (muss zuerst)

### Task 5A.2: `rest-endpoints` — REST API für Runs, Plans, Sessions + Tests

**Beschreibung:** REST-Endpoints für historische Daten. Read-only. Nutzen bestehende Storage-Module.

**Dateien erstellt/geändert:**
- `src/dashboard/routes/runs.ts` (GET /api/runs, GET /api/runs/:id)
- `src/dashboard/routes/plans.ts` (GET /api/plans, GET /api/plans/:id)
- `src/dashboard/routes/sessions.ts` (GET /api/sessions, GET /api/sessions/:id)
- `src/dashboard/__tests__/routes.test.ts` (mind. 8 Tests)
- `src/dashboard/routes/index.ts` (Route-Registration)

**Acceptance Criteria:**
- `GET /api/runs` — Liste aller Runs (ID, Status, Datum, Token-Usage)
- `GET /api/runs/:id` — Vollständiger Run mit Messages und Tool-Calls
- `GET /api/plans` — Liste aller Pläne (ID, Titel, Status, Step-Count)
- `GET /api/plans/:id` — Vollständiger Plan mit allen Steps
- `GET /api/sessions` — Liste aller Sessions
- `GET /api/sessions/:id` — Session mit Messages
- 404 bei nicht-existierenden IDs
- Tests: Jeder Endpoint, 404-Case, Listenformat
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 5A.1, parallel zu 5A.3)

### Task 5A.3: `websocket-bridge` — Event Bus → WebSocket Broadcast + Tests

**Beschreibung:** WebSocket-Server der alle Event-Bus-Events an verbundene Clients broadcastet. Clients können sich auf bestimmte Event-Typen subscriben.

**Dateien erstellt/geändert:**
- `src/dashboard/ws-bridge.ts` (WebSocketBridge: attach(server, eventBus), broadcast, subscribe)
- `src/dashboard/__tests__/ws-bridge.test.ts` (mind. 6 Tests)
- `src/dashboard/index.ts` (Barrel-Export)

**WebSocket-Protokoll:**
```typescript
// Client → Server (Subscribe):
{ type: "subscribe", events: ["run:*", "tool:*"] }
{ type: "unsubscribe", events: ["tool:*"] }

// Server → Client (Event):
{ type: "event", event: "run:start", data: { runId: "...", ... }, timestamp: "..." }

// Server → Client (Connection):
{ type: "connected", clientId: "...", subscribedEvents: ["*"] }
```

**Acceptance Criteria:**
- WebSocket auf `/ws` Pfad
- Default: alle Events broadcasten (subscribe `*`)
- Client kann Event-Filter setzen via subscribe/unsubscribe
- Glob-Pattern-Matching für Event-Filter
- Heartbeat/Ping alle 30s
- Connection-Tracking (clientId, connectedAt)
- Tests: Verbindung, Event-Broadcast, Subscribe-Filter, Disconnect-Cleanup
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 5A.1, parallel zu 5A.2)

### Task 5A.4: `dashboard-cli` — CLI-Befehl + Server-Integration + Tests

**Beschreibung:** `workbench dashboard` CLI-Befehl startet den Fastify-Server.

**Dateien erstellt/geändert:**
- `src/cli/dashboard-command.ts` (`workbench dashboard` — startet Server)
- `src/dashboard/create-dashboard.ts` (Factory: Server + Routes + WS-Bridge + EventBus verdrahten)
- `src/cli/index.ts` (Command registrieren)
- `src/cli/__tests__/dashboard-command.test.ts` (mind. 3 Tests)

**CLI-Befehle:**
```
workbench dashboard                 # Startet auf default Port 3000
workbench dashboard --port 8080     # Custom Port
workbench dashboard --open          # Öffnet Browser (optional)
```

**Acceptance Criteria:**
- `workbench dashboard` startet Server, gibt URL auf stdout aus
- Server empfängt Events vom globalen Event Bus
- CTRL+C → graceful Shutdown
- Port-Conflict: klare Fehlermeldung
- Tests: Command-Registration, Port-Konfiguration, Server-Lifecycle
- `npx tsc --noEmit` + `npm run build` + `npm run test` grün

**Komplexität:** S
**Parallelisierbar:** Nein (nach 5A.2 + 5A.3)

## Parallelisierungs-Plan
```
Wave 1 (sequentiell):
  Task 5A.1 (fastify-server) ──

Wave 2 (parallel):
  Task 5A.2 (rest-endpoints)  ──┐
  Task 5A.3 (websocket-bridge) ──┘

Wave 3 (sequentiell):
  Task 5A.4 (dashboard-cli)   ──
```

## Agent-Bedarf
- **2 Worker** (parallel in Wave 2)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test`
- `workbench dashboard` startet fehlerfrei, `/health` antwortet

## Offene Fragen / Risiken
- **Fastify-Version:** @fastify/websocket Plugin für WS-Support. Kompatibilität prüfen.
- **Shared Event Bus:** Dashboard läuft im gleichen Prozess wie Agent in Phase 1 (einfacher). Separater Prozess via IPC wäre spätere Optimierung.
- **Auth:** Kein Auth in Phase 1. Nur localhost.
