# REST-Endpoints Integration Guide

## Implementierte Endpoints

### Runs API
- **GET /api/runs** — Liste aller Runs mit Metadaten
  - Response: `RunMetadata[]`
  - Felder: id, startedAt, endedAt, status, prompt, tokenUsage

- **GET /api/runs/:id** — Vollständiger Run mit Messages und Tool-Calls
  - Response: `RunLog` oder `{ error: "Not found" }` (404)
  - Felder: metadata, messages[], toolCalls[]

### Plans API
- **GET /api/plans** — Liste aller Pläne mit Metadaten
  - Response: `Array<{ id, title, description, status, createdAt, updatedAt, stepCount }>`

- **GET /api/plans/:id** — Vollständiger Plan mit allen Steps
  - Response: `Plan` oder `{ error: "Not found" }` (404)

### Sessions API
- **GET /api/sessions** — Liste aller Sessions mit Metadaten
  - Response: `Array<{ id, agentId, status, createdAt, updatedAt, messageCount }>`

- **GET /api/sessions/:id** — Vollständige Session mit Messages
  - Response: `Session` oder `{ error: "Not found" }` (404)

## Integration in Server

```typescript
import { createServer } from './dashboard/server.js';
import { registerRoutes } from './dashboard/routes/index.js';
import { RunLogger } from './storage/run-logger.js';
import { SessionStorage } from './storage/session-storage.js';
import { PlanStorage } from './task/plan-storage.js';

// Create server
const fastify = createServer(config);

// Initialize storage instances
const runLogger = new RunLogger();
const sessionStorage = new SessionStorage();
const planStorage = new PlanStorage();

// Register routes
await registerRoutes(fastify, {
  runLogger,
  sessionStorage,
  planStorage,
});

// Start server
await fastify.listen({ port: 3000, host: '0.0.0.0' });
```

## Neue Methode in RunLogger

**`listRuns(): Promise<RunMetadata[]>`**
- Liest alle Run-Verzeichnisse aus `~/.workbench/runs/`
- Gibt Metadaten aller Runs zurück (kein Full-Load von Messages/ToolCalls)
- Analog zu `SessionStorage.list()` und `PlanStorage.list()`
- Gibt leeres Array zurück wenn Runs-Verzeichnis nicht existiert

## Testing

Alle Endpoints haben Tests:
- Liste abrufen (leere + gefüllte Liste)
- Details abrufen (existierende + nicht-existierende IDs)
- 404-Handling
- Error-Handling (500 bei Storage-Fehlern)

**Test-Coverage:**
- 12 neue Route-Tests in `src/dashboard/__tests__/routes.test.ts`
- 2 neue RunLogger-Tests für `listRuns()`
- Alle Tests grün (275 Tests total)
