# Epic 27: async-embeddings — Non-Blocking Memory Performance

## Ziel
Embedding-Generierung aus dem kritischen Pfad entfernen. CLI returnt sofort nach Run-Completion, Memory-Speicherung läuft asynchron im Hintergrund. Reduziert CLI-Latenz von 15s auf 2s bei aktivem Auto-Memory.

**Problem:** Auto-Memory blockiert CLI-Exit (User wartet 5-15s auf Embedding-Generation nach jedem Run)  
**Lösung:** Fire-and-forget Background-Queue für Embedding + Memory-Storage. RunMetadata.memoryId wird nachträglich gesetzt.

## Abhängigkeiten
- Epic 24 (session-summarizer) — Auto-Memory vorhanden ✅
- Epic 7 (memory) — LanceDB + Embedding-Provider vorhanden ✅

## Tasks

### Task 27.1: `background-embedding-queue` — Async Embedding-Pipeline

**Beschreibung:**
Embedding-Generierung aus onAfterRun-Hook entfernen und in Background-Queue verschieben. CLI blockiert nicht mehr auf Memory-Speicherung.

**Dateien erstellt/geändert:**
- `src/memory/embedding-queue.ts` (Background-Queue mit graceful shutdown)
- `src/memory/auto-memory.ts` (Fire-and-forget statt await)
- `src/storage/run-logger.ts` (Add updateMetadata() für nachträgliche memoryId)
- `src/memory/__tests__/embedding-queue.test.ts` (Unit Tests)

**Queue-Design:**
```typescript
// src/memory/embedding-queue.ts
export class EmbeddingQueue {
  private queue: Array<EmbeddingTask> = [];
  private processing = false;
  
  /**
   * Add task to background queue (non-blocking)
   */
  enqueue(task: EmbeddingTask): void {
    this.queue.push(task);
    void this.processQueue(); // Fire-and-forget
  }
  
  /**
   * Process queue in background (FIFO)
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await this.processTask(task);
      } catch (err) {
        console.warn('[EmbeddingQueue] Failed to process task:', err);
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Graceful shutdown: Wait for queue to drain
   */
  async drain(timeout = 30000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (this.queue.length > 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
```

**Auto-Memory Integration:**
```typescript
// src/memory/auto-memory.ts
export function createAutoMemoryHook(config: AutoMemoryConfig) {
  return async (result: RunResult, context: { runId: string }) => {
    // ... validation ...
    
    // ✅ Enqueue statt await (non-blocking)
    config.embeddingQueue.enqueue({
      sessionId: result.sessionId,
      runId: context.runId,
      messages: session.messages,
      runMetadata: runLog.metadata,
    });
    
    // CLI returnt sofort, kein Warten auf Embedding
  };
}
```

**RunLogger Extension:**
```typescript
// src/storage/run-logger.ts
export class RunLogger {
  // ... existing methods ...
  
  /**
   * Update run metadata after async completion
   */
  async updateMetadata(
    runId: string,
    updates: Partial<RunMetadata>
  ): Promise<void> {
    const runPath = path.join(this.runsDir, runId, 'run.json');
    const existing = await this.loadRun(runId);
    if (!existing) throw new Error(`Run ${runId} not found`);
    
    const updated = { ...existing.metadata, ...updates };
    await writeFile(runPath, JSON.stringify({ ...existing, metadata: updated }, null, 2));
  }
}
```

**Acceptance Criteria:**
- ✅ EmbeddingQueue processes tasks FIFO
- ✅ CLI returnt sofort (kein Warten auf Embedding)
- ✅ Memory-Entry wird erstellt (async, 1-10s delay)
- ✅ RunMetadata.memoryId wird nachträglich gesetzt
- ✅ Graceful shutdown: drain() wartet auf Queue-Completion
- ✅ Error-Handling: Failed embeddings loggen, werfen nicht
- ✅ TypeScript kompiliert
- ✅ Unit Tests für Queue-Logic

**Komplexität:** M  
**Parallelisierbar:** Nein (Core-Refactor)

---

### Task 27.2: `async-memory-tests` — E2E Tests für Async-Behavior

**Beschreibung:**
Update E2E Tests für async Memory-Speicherung. Tests pollen für memoryId statt sofortiger Erwartung.

**Dateien geändert:**
- `src/test/e2e/auto-memory.test.ts` (Async polling für memoryId)
- `src/test/helpers/wait-for-memory.ts` (Helper: Poll für memoryId mit Timeout)

**Test-Helpers:**
```typescript
// src/test/helpers/wait-for-memory.ts
export async function waitForMemoryId(
  runLogger: RunLogger,
  runId: string,
  options: { timeout?: number } = {}
): Promise<RunMetadata> {
  const deadline = Date.now() + (options.timeout ?? 10000);
  
  while (Date.now() < deadline) {
    const runLog = await runLogger.loadRun(runId);
    if (runLog?.metadata.memoryId) {
      return runLog.metadata;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`memoryId not set after ${options.timeout}ms`);
}
```

**Test-Update:**
```typescript
// src/test/e2e/auto-memory.test.ts
it('should create memory entry after successful run (async)', async () => {
  const result = await runCli({
    args: ['run', 'Test async memory'],
    env: testEnv.env,
    timeout: 15000,
  });
  
  expect(result.exitCode).toBe(0);
  
  // ✅ Poll for memoryId (background embedding might still run)
  const runMetadata = await waitForMemoryId(runLogger, runId, { timeout: 10000 });
  expect(runMetadata.memoryId).toBeDefined();
  
  // ✅ Verify embedding was actually generated (not mocked!)
  const memoryEntry = await memoryStore.get(runMetadata.memoryId!);
  expect(memoryEntry).toBeDefined();
  expect(memoryEntry!.type).toBe('session');
  
  // ✅ Verify real embedding vector exists (not mock)
  const dbEntry = await memoryStore['table'].search(memoryEntry!.content).limit(1).toArray();
  expect(dbEntry[0].vector).toBeDefined();
  expect(dbEntry[0].vector.length).toBe(384); // Real MiniLM embedding dimension
});
```

**Acceptance Criteria:**
- ✅ E2E Tests nutzen waitForMemoryId() statt sofortige Checks
- ✅ Tests validieren echte Embeddings (nicht gemockt)
- ✅ Tests passed in <15s (CLI instant + 10s async poll)
- ✅ 3x Full-Suite-Run ohne Flakiness
- ✅ TypeScript kompiliert

**Komplexität:** S  
**Parallelisierbar:** Ja (nach 27.1)

---

### Task 27.3: `vitest-timeout-reduction` — Reduce Test Timeout to 10s

**Beschreibung:**
Nach Async-Embedding-Optimierung können E2E Tests schneller laufen. Global Timeout von 15s auf 10s reduzieren.

**Dateien geändert:**
- `vitest.config.ts` (testTimeout: 10000)
- `src/test/e2e/auto-memory.test.ts` (Remove TODO-Comments aus Epic 24)

**Changes:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000, // ✅ 10s (was: 15s from Epic 24)
    // ...
  },
});
```

**Acceptance Criteria:**
- ✅ Alle 968 Tests passed @ 10s timeout
- ✅ Kein Test braucht >10s (async embeddings im Background)
- ✅ 3x Full-Suite-Run ohne Timeouts

**Komplexität:** XS  
**Parallelisierbar:** Ja (nach 27.2)

---

### Task 27.4: `graceful-shutdown` — CLI Shutdown Hook für Queue-Drain

**Beschreibung:**
Beim CLI-Exit soll EmbeddingQueue.drain() gecalled werden (optional, mit Timeout). Verhindert Data-Loss bei SIGTERM/SIGINT.

**Dateien geändert:**
- `src/cli/run-command.ts` (process.on('SIGTERM', ...) Hook)
- `src/memory/embedding-queue.ts` (drain() Implementation)

**Shutdown-Hook:**
```typescript
// src/cli/run-command.ts
export async function runCommand(prompt: string, options: RunCommandOptions) {
  // ... setup ...
  
  // Register shutdown hook
  let isShuttingDown = false;
  const shutdownHandler = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    console.log('\n⏳ Waiting for background tasks to complete...');
    await embeddingQueue.drain(10000); // 10s max wait
    process.exit(0);
  };
  
  process.on('SIGTERM', shutdownHandler);
  process.on('SIGINT', shutdownHandler);
  
  // ... run agent ...
}
```

**Acceptance Criteria:**
- ✅ SIGTERM/SIGINT triggern graceful shutdown
- ✅ EmbeddingQueue.drain() wartet max 10s
- ✅ Nach Timeout: Exit ohne Queue-Drain (akzeptabel)
- ✅ User sieht "Waiting for background tasks..." Message
- ✅ TypeScript kompiliert
- ✅ E2E Test: SIGTERM während embedding → memoryId trotzdem gesetzt

**Komplexität:** S  
**Parallelisierbar:** Ja (nach 27.1)

---

## Metriken & Erfolg

**Performance-Ziele:**
- CLI-Latenz: 15s → 2s (bei aktivem Auto-Memory)
- E2E Test-Duration: 15s → 10s
- Memory-Speicherung: Async (1-10s delay akzeptabel)

**Qualitätsziele:**
- 0 Data-Loss (auch bei SIGTERM)
- 0 Flaky Tests (echte Embeddings, kein Mock)
- Graceful Degradation: Embedding-Fehler → Warning statt Crash

---

## Risiken

- **Queue-Overflow:** Bei vielen Runs könnte Queue wachsen → **Mitigation: Max-Queue-Size (100 tasks), älteste droppen**
- **Memory-Leak:** Queue hält References → **Mitigation: Weak-References für Messages**
- **Shutdown-Timeout:** User CTRL+C → Queue nicht fertig → **Akzeptabel: Log-Warning, kein Blocking**

---

## Parallelisierung

**Wave 1 (sequentiell):**
- Task 27.1: background-embedding-queue

**Wave 2 (parallel nach 27.1):**
- Task 27.2: async-memory-tests
- Task 27.4: graceful-shutdown

**Wave 3 (parallel nach 27.2):**
- Task 27.3: vitest-timeout-reduction
