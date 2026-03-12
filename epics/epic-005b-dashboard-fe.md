# Epic 5B: dashboard-fe — React SPA (Session/Tool/Diff Viewer)

## Ziel
React-basierte Single-Page-Application als Dev Dashboard: Live-Ansicht laufender Runs, Tool-Call-Details, Diff-Viewer für Dateiänderungen, Plan-Übersicht. Kommuniziert via REST (historisch) und WebSocket (live) mit dem Backend.

## Abhängigkeiten
- Epic 5A (dashboard-be) — REST-Endpoints + WebSocket-Bridge müssen existieren

## Tasks

### Task 5B.1: `react-scaffold` — Vite + React + TailwindCSS Setup + Tests

**Beschreibung:** Frontend-Projekt als Sub-Package im Monorepo aufsetzen. Vite als Build-Tool, React 18+, TailwindCSS, TypeScript.

**Dateien erstellt/geändert:**
- `src/dashboard/ui/package.json` (React, Vite, Tailwind deps)
- `src/dashboard/ui/vite.config.ts` (Vite-Config, Proxy zu Backend API)
- `src/dashboard/ui/tailwind.config.js` (Tailwind-Config)
- `src/dashboard/ui/tsconfig.json` (TypeScript-Config, Path-Aliases zu Shared Types)
- `src/dashboard/ui/index.html` (SPA Entry)
- `src/dashboard/ui/src/App.tsx` (Root-Komponente mit Router)
- `src/dashboard/ui/src/main.tsx` (React Entry)
- `src/dashboard/ui/src/__tests__/App.test.tsx` (mind. 2 Tests)

**Acceptance Criteria:**
- `cd src/dashboard/ui && npm install && npm run dev` startet Dev-Server
- `npm run build` erstellt Production-Build in `dist/`
- TailwindCSS funktioniert
- Shared Types aus Hauptprojekt importierbar
- Tests: App rendert, Router zeigt Default-Route
- `npx tsc --noEmit` grün

**Komplexität:** M
**Parallelisierbar:** Nein (muss zuerst)

### Task 5B.2: `ws-client` — WebSocket Client Hook + API Client + Tests

**Beschreibung:** React Hooks für WebSocket-Verbindung und REST-API. Auto-Reconnect, Event-Subscription, Typed Events.

**Dateien erstellt/geändert:**
- `src/dashboard/ui/src/hooks/useWebSocket.ts` (useWebSocket Hook)
- `src/dashboard/ui/src/hooks/useApi.ts` (useApi Hook)
- `src/dashboard/ui/src/lib/api-client.ts` (API-Client: fetch-Wrapper)
- `src/dashboard/ui/src/__tests__/hooks.test.ts` (mind. 6 Tests)

**Acceptance Criteria:**
- `useWebSocket()` verbindet automatisch, reconnected (exponential Backoff)
- Event-Subscription via Glob-Pattern
- Typed Events (gleiche EventMap wie Backend)
- `useApi(endpoint)` gibt `{ data, loading, error, refetch }` zurück
- Tests: Connection-Lifecycle, Event-Empfang, API-Fetch, Error-Handling
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Nein (nach 5B.1, vor 5B.3 + 5B.4)

### Task 5B.3: `run-viewer` — Session/Run-Ansicht + Tests

**Beschreibung:** Hauptansicht: Liste laufender/vergangener Runs mit Detail-View.

**Dateien erstellt/geändert:**
- `src/dashboard/ui/src/pages/RunsPage.tsx` (Run-Liste mit Filter/Sort)
- `src/dashboard/ui/src/pages/RunDetailPage.tsx` (Run-Detail: Messages, Tools, Tokens)
- `src/dashboard/ui/src/components/MessageList.tsx` (Message-Timeline)
- `src/dashboard/ui/src/components/ToolCallCard.tsx` (Tool-Call-Detail)
- `src/dashboard/ui/src/components/TokenBadge.tsx` (Token-Usage)
- `src/dashboard/ui/src/__tests__/RunViewer.test.tsx` (mind. 5 Tests)

**Acceptance Criteria:**
- Run-Liste: ID, Status-Badge, Datum, Token-Count, Dauer
- Run-Detail: chronologische Message-Timeline
- Tool-Calls: expandierbar mit Input/Output (JSON formatted)
- Live-Update via WebSocket (neue Runs, Status-Updates)
- Token-Usage pro Step und kumulativ
- Tests: Render, Live-Update-Simulation, Tool-Call-Expansion, Empty-State
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** L
**Parallelisierbar:** Ja (nach 5B.2, parallel zu 5B.4)

### Task 5B.4: `plan-viewer` — Plan-Ansicht + Diff Viewer + Tests

**Beschreibung:** Plan-Übersicht mit Step-Fortschritt und Diff-Viewer.

**Dateien erstellt/geändert:**
- `src/dashboard/ui/src/pages/PlansPage.tsx` (Plan-Liste)
- `src/dashboard/ui/src/pages/PlanDetailPage.tsx` (Plan-Detail mit Step-Timeline)
- `src/dashboard/ui/src/components/StepProgress.tsx` (Fortschrittsanzeige)
- `src/dashboard/ui/src/components/DiffViewer.tsx` (Diff-Ansicht)
- `src/dashboard/ui/src/__tests__/PlanViewer.test.tsx` (mind. 5 Tests)

**Acceptance Criteria:**
- Plan-Liste: Titel, Status, Step-Fortschritt (3/7 completed)
- Plan-Detail: Step-Timeline mit Status-Icons
- Step expandierbar: Prompt, Result, geänderte Dateien
- Diff-Viewer: Syntax-Highlighting, Line-Numbers
- Live-Update: Steps wechseln Status in Echtzeit
- Tests: Render, Step-Fortschritt, Diff-Darstellung, Live-Updates
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** L
**Parallelisierbar:** Ja (nach 5B.2, parallel zu 5B.3)

## Parallelisierungs-Plan
```
Wave 1 (sequentiell):
  Task 5B.1 (react-scaffold)  ──

Wave 2 (sequentiell):
  Task 5B.2 (ws-client)       ──

Wave 3 (parallel):
  Task 5B.3 (run-viewer)      ──┐
  Task 5B.4 (plan-viewer)     ──┘
```

## Agent-Bedarf
- **2 Worker** (parallel in Wave 3)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` (Hauptprojekt + UI)
- `npm run build` (Hauptprojekt)
- `cd src/dashboard/ui && npm run build` (UI Production-Build)
- `npm run test` (alle Tests inkl. UI-Tests)

## Offene Fragen / Risiken
- **Diff-Viewer Library:** `react-diff-viewer-continued` empfohlen. Gut maintained, wenig Overhead.
- **Shared Types:** Import-Pfade zwischen Hauptprojekt und UI müssen sauber konfiguriert sein.
- **Static File Serving:** Production-Build wird vom Fastify-Server ausgeliefert.
- **Testing Library:** `@testing-library/react` + `vitest` + `jsdom` für Component-Tests.
