# Epic 21: model-system-robustness — Robustes Model-Handling

## Ziel
Das Model-Handling von Workbench robuster und wartbarer machen. Aktuell sind Model-Namen hardcoded und verteilt, es gibt keine Alias-Unterstützung und keine Fallback-Chain bei API-Fehlern. Ein 404 bei einem veralteten Model-String (z.B. `claude-3-5-sonnet-20241022`) stoppt den Agent komplett.

**Kontext:** Bug-Fix heute hat gezeigt: hardcoded `claude-3-5-sonnet-20241022` → 404. Gap-Analyse gegen OpenClaw: unser Model-Handling braucht Konsolidierung, Aliase und Fallbacks.

**Scope:** Drei Features — zentrale Konstanten, Alias-System, Fallback-Chain. KEIN Setup-Token-Support in diesem Epic.

## Abhängigkeiten
- Epic 1C (Agent Runtime) — AnthropicClient ist bereits vorhanden
- Epic 5A (Dashboard BE) — Config-Handling ist vorhanden

## Tasks

### Task 21.1: `consolidate-model-constants` — Zentrale Model-Konstanten

**Beschreibung:** Alle hardcoded Model-Strings an einer Stelle zusammenführen. Aktuell existieren `DEFAULT_MODEL` sowohl in `config.ts` als auch in `agent/config.ts` — Inkonsistenz beseitigen. API-URL ebenfalls als Konstante definieren.

**Dateien erstellt/geändert:**
- `src/config/models.ts` (neu — zentrale Model-Konstanten)
- `src/config/index.ts` (Export erweitern)
- `src/config.ts` (DEFAULT_MODEL entfernen, Import aus models.ts)
- `src/agent/config.ts` (DEFAULT_MODEL entfernen, Import aus models.ts)
- `src/anthropic/client.ts` (API_URL als Konstante)
- `src/config/__tests__/models.test.ts` (neu — Konstanten testen)

**Code-Beispiel:**
```typescript
// src/config/models.ts
export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export const DEFAULT_MODEL = 'claude-sonnet-4-5-20250514';

export const MODEL_CONSTANTS = {
  DEFAULT: DEFAULT_MODEL,
  FALLBACK: 'claude-3-5-sonnet-20241022',
  OPUS_4: 'claude-opus-4-20250514',
} as const;
```

**Acceptance Criteria:**
- Alle hardcoded Model-Strings zentral in `models.ts`
- `DEFAULT_MODEL` existiert nur noch in `models.ts`
- Keine Inkonsistenzen zwischen `config.ts` und `agent/config.ts`
- API-URL als Konstante in `anthropic/client.ts`
- Alle bestehenden Tests grün (keine Behavior-Änderung)
- `npx tsc --noEmit` + `npm run test`

**Komplexität:** S (1-3h)  
**Parallelisierbar:** Nein — Prerequisite für 21.2 und 21.3

### Task 21.2: `model-alias-system` — Alias-System für Model-Namen

**Beschreibung:** Alias-Map für kurze/leserliche Model-Namen implementieren (z.B. `"opus-4"` → `"claude-opus-4-20250514"`). Normalisierung: trim → lowercase → alias-lookup → fallback original. Integration in AnthropicClient vor API-Request.

**Dateien erstellt/geändert:**
- `src/config/models.ts` (MODEL_ALIASES Map hinzufügen)
- `src/config/model-resolver.ts` (neu — resolveModelName Funktion)
- `src/anthropic/client.ts` (resolveModelName integrieren)
- `src/config/__tests__/model-resolver.test.ts` (neu — Unit-Tests)

**Code-Beispiel:**
```typescript
// src/config/models.ts
export const MODEL_ALIASES = {
  'opus-4': 'claude-opus-4-20250514',
  'sonnet-4': 'claude-sonnet-4-20250514',
  'sonnet-3.5': 'claude-3-5-sonnet-20241022',
} as const;

// src/config/model-resolver.ts
export function resolveModelName(input: string): string {
  const normalized = input.trim().toLowerCase();
  return MODEL_ALIASES[normalized] || input;
}
```

**Acceptance Criteria:**
- Alias-Map mit mindestens 3 Einträgen (opus-4, sonnet-4, sonnet-3.5)
- `resolveModelName()` normalisiert: trim + lowercase
- Alias-Lookup vor Original-Fallback
- Integration in `AnthropicClient.sendMessage()` vor API-Call
- Mindestens 8 Unit-Tests: alias hit, alias miss, case-insensitive, whitespace trim, empty string, unknown alias, original passthrough
- `npx tsc --noEmit` + `npm run test`

**Komplexität:** S (1-3h)  
**Parallelisierbar:** Nach 21.1, parallel zu 21.3

### Task 21.3: `model-fallback-chain` — Fallback-Chain bei API-Fehlern

**Beschreibung:** Fallback-Config mit Candidate-Liste (primary + fallbacks). Retry-Logic bei 404/429/503. Cooldown-Management (in-memory). Error-Classification (welche Fehler triggern Fallback?). EventBus-Events für Observability.

**Dateien erstellt/geändert:**
- `src/config/models.ts` (FALLBACK_CHAIN Config hinzufügen)
- `src/anthropic/fallback-handler.ts` (neu — Fallback-Logic + Cooldown)
- `src/anthropic/client.ts` (Fallback-Handler integrieren)
- `src/anthropic/error-classifier.ts` (neu — Error → Fallback-Trigger prüfen)
- `src/events/model-events.ts` (neu — ModelFallbackTriggered Event)
- `src/anthropic/__tests__/fallback-handler.test.ts` (neu — Integration-Tests mit Mock-Errors)

**Code-Beispiel:**
```typescript
// src/config/models.ts
export const FALLBACK_CHAIN = [
  'claude-sonnet-4-5-20250514',
  'claude-opus-4-20250514',
  'claude-3-5-sonnet-20241022',
] as const;

// src/anthropic/fallback-handler.ts
export class FallbackHandler {
  private cooldowns = new Map<string, number>();
  
  shouldTriggerFallback(error: Error): boolean {
    // 404, 429, 503 → true
  }
  
  getNextModel(currentModel: string): string | null {
    // Cooldown-Check + nächster Candidate
  }
  
  recordFailure(model: string): void {
    // Cooldown setzen (z.B. 5 Min)
  }
}
```

**Acceptance Criteria:**
- Fallback-Config mit mindestens 3 Model-Candidates
- Error-Classification: 404/429/503 triggern Fallback, andere Errors nicht
- Retry-Logic versucht nächsten Candidate bei Fallback-Trigger
- Cooldown-Management: Model nach Failure für 5 Min gesperrt
- EventBus-Event `ModelFallbackTriggered` mit { from, to, reason }
- Mindestens 10 Integration-Tests: 404 → fallback, 429 → fallback, 503 → fallback, cooldown respected, all models exhausted, non-retriable error → throw, success after fallback
- `npx tsc --noEmit` + `npm run test`

**Komplexität:** M (4-8h)  
**Parallelisierbar:** Nach 21.1, parallel zu 21.2

## Parallelisierungs-Plan

```
Wave 1 (sequentiell):
  Task 21.1 (consolidate-model-constants)  ──

Wave 2 (parallel):
  Task 21.2 (model-alias-system)           ──┐
  Task 21.3 (model-fallback-chain)         ──┘
```

## Agent-Bedarf
- **2 Worker** (max parallel in Wave 2)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test`
- Alle bestehenden Tests bleiben grün
- Mindestens 18 neue Tests (6 + 8 + 10 aus Tasks)
- Keine hardcoded Model-Strings außerhalb `models.ts`
- EventBus erweitert um Model-Events
- Config-Schema validiert (falls JSON-Schema-Validation aktiv)

## Offene Fragen / Risiken
- **Cooldown-Persistence:** In-memory Cooldown reicht für MVP. Persistent Cooldown (Redis/File) kommt später falls nötig.
- **Fallback-Exhaustion:** Wenn alle Models fehlschlagen, wird Original-Error geworfen. Monitoring via EventBus hilft bei Diagnose.
- **Rate-Limits:** Fallback-Chain könnte bei 429 (rate limit) zusätzliche Requests generieren. Mitigation: Cooldown + exponentielles Backoff (Future Enhancement).
- **Model-Version-Drift:** Neue Model-Versionen müssen manuell in Konstanten + Aliases eingetragen werden. Automatische Discovery (API-basiert) ist out of scope.
