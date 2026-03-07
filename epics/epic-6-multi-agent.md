# Epic 6: multi-agent — Multi-Agent Support

## Ziel
Mehrere Agents spawnen und koordinieren: ein Planner-Agent zerlegt Aufgaben, Worker-Agents führen Steps parallel aus. Inter-Agent-Kommunikation via Message-Passing, Agent-Lifecycle-Management.

## Abhängigkeiten
- Epic 1C (runtime-cli) — Agent Runtime Loop
- Epic 4 (task-system) — Plan/Step-Primitives für Planner-Worker-Pattern

## Tasks

### Task 6.1: `agent-types` — Multi-Agent Type-Definitionen + Tests

**Beschreibung:** Types für Agent-Identität, Agent-Registry, Inter-Agent-Messages.

**Dateien erstellt/geändert:**
- `src/types/agent.ts` (AgentInstance, AgentRole, AgentMessage, AgentStatus, SpawnConfig)
- `src/multi-agent/validation.ts` (validateSpawnConfig)
- `src/multi-agent/__tests__/validation.test.ts` (mind. 5 Tests)
- `src/multi-agent/index.ts` (Barrel-Export)

**Type-Definitionen:**
```typescript
type AgentRole = 'planner' | 'worker' | 'reviewer' | 'custom';
type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'terminated';

interface AgentInstance {
  id: string;
  role: AgentRole;
  name: string;
  status: AgentStatus;
  config: AgentConfig;
  parentId?: string;
  sessionId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface SpawnConfig {
  role: AgentRole;
  name?: string;
  model?: string;
  systemPrompt?: string;
  tools?: string[];
  maxSteps?: number;
  cwd?: string;
}

interface AgentMessage {
  from: string;
  to: string;
  type: 'task' | 'result' | 'status' | 'error';
  payload: unknown;
  timestamp: string;
}
```

**Acceptance Criteria:**
- Alle Types exportiert und importierbar
- SpawnConfig-Validierung: Rolle gesetzt, maxSteps > 0
- AgentMessage-Validierung: from, to, type gesetzt
- Tests: gültige Configs, fehlende Felder, ungültige Rolle, Message-Validierung
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** S
**Parallelisierbar:** Nein (muss zuerst)

### Task 6.2: `agent-registry` — Agent-Lifecycle-Management + Tests

**Beschreibung:** Registry die alle aktiven Agents verwaltet.

**Dateien erstellt/geändert:**
- `src/multi-agent/agent-registry.ts` (AgentRegistry: spawn, terminate, get, list, getByRole, onStatusChange)
- `src/multi-agent/__tests__/agent-registry.test.ts` (mind. 8 Tests)
- `src/multi-agent/index.ts` (Barrel-Export)

**Acceptance Criteria:**
- `spawn(config)` erstellt AgentInstance mit UUID, Status `idle`, eigener Session
- `terminate(id)` setzt Status `terminated`, cleanup
- `get(id)`, `list(filter?)`, `getByRole(role)`
- Events: `agent:spawned`, `agent:status`, `agent:terminated`
- Max-Agent-Limit konfigurierbar (default: 10)
- Tests: Spawn/Terminate-Lifecycle, Lookup, Filter, Max-Limit, Events
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 6.1, parallel zu 6.3)

### Task 6.3: `message-bus` — Inter-Agent Message-Passing + Tests

**Beschreibung:** Message-Bus für Agent-zu-Agent-Kommunikation.

**Dateien erstellt/geändert:**
- `src/multi-agent/message-bus.ts` (MessageBus: send, broadcast, onMessage, getQueue)
- `src/multi-agent/__tests__/message-bus.test.ts` (mind. 7 Tests)
- `src/multi-agent/index.ts` (Barrel-Export)

**Acceptance Criteria:**
- `send(from, to, type, payload)` liefert an spezifischen Agent
- `broadcast(from, type, payload)` an alle
- `onMessage(agentId, callback)` registriert Handler
- Message-Queue + History pro Agent
- Events: `message:sent`, `message:received`
- Tests: Send/Receive, Broadcast, Queue, History, Handler, unbekannter Empfänger
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Ja (nach 6.1, parallel zu 6.2)

### Task 6.4: `agent-tools` — spawn_agent, send_message, list_agents Tools + Tests

**Beschreibung:** Drei neue Tools für Agent-Steuerung.

**Dateien erstellt/geändert:**
- `src/tools/spawn-agent.ts` (SpawnAgentTool)
- `src/tools/send-message.ts` (SendMessageTool)
- `src/tools/list-agents.ts` (ListAgentsTool)
- `src/tools/__tests__/agent-tools.test.ts` (mind. 8 Tests)
- `src/tools/defaults.ts` (3 neue Tools → 11 total)

**Acceptance Criteria:**
- `spawn_agent` erstellt Worker/Reviewer via AgentRegistry
- `send_message` sendet via MessageBus
- `list_agents` gibt formatierte Liste zurück
- Keine Agents mit höherer Privilegierung spawnbar
- Tests: Spawn+Verify, Send+Receive, List, Privilege-Check
- `npx tsc --noEmit` + `npm run build` + `npm run test` grün

**Komplexität:** M
**Parallelisierbar:** Nein (nach 6.2 + 6.3)

### Task 6.5: `agent-orchestrator` — Planner-Worker-Pattern + Tests

**Beschreibung:** Orchestrator für Planner-Worker-Pattern.

**Dateien erstellt/geändert:**
- `src/multi-agent/orchestrator.ts` (AgentOrchestrator: executePlan, assignStep, collectResults)
- `src/multi-agent/__tests__/orchestrator.test.ts` (mind. 6 Tests mit Mocks)
- `src/multi-agent/index.ts` (Barrel-Export)

**Orchestrator-Logik:**
```
1. Plan empfangen
2. Worker-Pool erstellen (N Workers basierend auf Parallelisierbarkeit)
3. Steps zuweisen (parallel → verschiedene Workers, sequentiell → nacheinander)
4. Ergebnisse sammeln via MessageBus
5. Plan-Status aktualisieren
6. Bei Fehler: Worker terminieren, Plan pausieren
```

**Acceptance Criteria:**
- Orchestrator spawnt Worker-Agents basierend auf Plan
- Steps korrekt zugewiesen (sequentiell/parallel)
- Ergebnisse gesammelt und in Plan geschrieben
- Fehler-Handling: Worker-Failure pausiert Plan
- Worker-Cleanup nach Completion
- Tests: Vollständiger Flow (Mock), Parallel-Execution, Fehler-Recovery, Cleanup
- `npx tsc --noEmit` + `npm run test` grün

**Komplexität:** L
**Parallelisierbar:** Nein (nach 6.4)

## Parallelisierungs-Plan
```
Wave 1 (sequentiell):
  Task 6.1 (agent-types)      ──

Wave 2 (parallel):
  Task 6.2 (agent-registry)   ──┐
  Task 6.3 (message-bus)      ──┘

Wave 3 (sequentiell):
  Task 6.4 (agent-tools)      ──

Wave 4 (sequentiell):
  Task 6.5 (orchestrator)     ──
```

## Agent-Bedarf
- **2 Worker** (parallel in Wave 2)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test`
- Event-Map erweitern: `agent:spawned`, `agent:status`, `agent:terminated`, `message:sent`, `message:received`
- Tool-Registry: 11 Tools total

## Offene Fragen / Risiken
- **Prozess-Isolation:** Phase 1 alle Agents im gleichen Node.js-Prozess (async). Echte Parallelität später.
- **Worker-Kontext:** Jeder Worker eigene Session + System-Prompt. Shared Context explizit via Messages.
- **Deadlock-Risiko:** Timeout pro Message-Delivery (default: 60s) als Safeguard.
- **Cost Control:** Max-Steps pro Worker + Max-Workers pro Plan als Limits.
