# Epic 21: model-system — Robustes Model-Handling für Anthropic LLM

## Ziel
Professionelles Model-Management für die Anthropic-Integration: zentrale Konstanten statt hardcoded Strings, Alias-System für benutzerfreundliche Model-Namen, und automatische Fallback-Chain bei Model-Ausfällen. Das System soll robust gegen temporäre Modelverfügbarkeits-Probleme sein und transparente Observability bieten.

## Abhängigkeiten
- Epic 1B (oauth-client) — AnthropicClient muss existieren
- Epic 2 (observability) — Event Bus für Fallback-Events

## Tasks

### Task 21.1: `model-constants` — Zentrale Model-Konstanten

**Beschreibung:** Alle hardcoded Model-Strings und API-URLs an einer zentralen Stelle konsolidieren. Aktuell ist `DEFAULT_MODEL` in `config.ts` und `defaultAgentConfig.model` in `agent/config.ts` redundant definiert. Die API-URL ist im `AnthropicClient`-Constructor hardcoded.

**Dateien erstellt/geändert:**
- `src/llm/model-constants.ts` (neu — Zentrale Konstanten-Datei)
- `src/llm/config.ts` (refactored — Import aus model-constants)
- `src/agent/config.ts` (refactored — Import aus model-constants)
- `src/llm/anthropic-client.ts` (refactored — API_URL als Konstante)

**Code-Beispiel** (`src/llm/model-constants.ts`):
```typescript
export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_API_VERSION = '2023-06-01';

export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export const AVAILABLE_MODELS = [
  'claude-opus-4-20250514',
  'claude-sonnet-4-20250514',
  'claude-haiku-4-20250514',
] as const;

export type ModelName = typeof AVAILABLE_MODELS[number];
```

**Acceptance Criteria:**
- Alle Model-Strings sind als Konstanten in `model-constants.ts` definiert
- `DEFAULT_MODEL` ist nur noch in `model-constants.ts` definiert
- `config.ts` und `agent/config.ts` importieren aus `model-constants.ts`
- `AnthropicClient` nutzt `ANTHROPIC_API_URL` Konstante statt hardcoded URL
- Alle Imports aktualisiert (grep nach alten Importen)
- `npx tsc --noEmit` kompiliert fehlerfrei
- Keine doppelten Definitionen mehr

**Komplexität:** S (1-3h)  
**Parallelisierbar:** Nein (Fundament für 21.2)

### Task 21.2: `model-aliases` — Alias-System für Model-Namen

**Beschreibung:** Benutzerfreundliche Aliases für Model-Namen implementieren. Statt `claude-opus-4-20250514` kann der User `opus-4` oder `opus` schreiben. Normalisierung mit Case-Insensitive Lookup und automatischem Fallback zum Original bei unbekannten Aliases.

**Dateien erstellt/geändert:**
- `src/llm/model-constants.ts` (erweitert — Alias-Map hinzufügen)
- `src/llm/model-normalization.ts` (neu — normalizeModel Funktion)
- `src/llm/anthropic-client.ts` (erweitert — Normalisierung vor API-Request)
- `src/llm/model-normalization.test.ts` (neu — Unit-Tests)

**Code-Beispiel** (`model-constants.ts` Erweiterung):
```typescript
export const MODEL_ALIASES: Record<string, ModelName> = {
  'opus-4': 'claude-opus-4-20250514',
  'opus': 'claude-opus-4-20250514',
  'sonnet-4': 'claude-sonnet-4-20250514',
  'sonnet': 'claude-sonnet-4-20250514',
  'haiku-4': 'claude-haiku-4-20250514',
  'haiku': 'claude-haiku-4-20250514',
} as const;
```

**Code-Beispiel** (`model-normalization.ts`):
```typescript
export function normalizeModel(input: string): string {
  const normalized = input.trim().toLowerCase();
  return MODEL_ALIASES[normalized] ?? input.trim(); // Fallback: Original zurückgeben
}
```

**Acceptance Criteria:**
- `normalizeModel()` Funktion implementiert: `trim()` → `toLowerCase()` → Alias-Lookup → Fallback Original
- Alias-Map für alle gängigen Model-Varianten (opus/sonnet/haiku, mit/ohne -4)
- Integration in `AnthropicClient.sendMessage()`: `model = normalizeModel(model)` vor API-Request
- Unit-Tests für Normalisierung:
  - `normalizeModel('Opus-4')` → `'claude-opus-4-20250514'`
  - `normalizeModel('  sonnet  ')` → `'claude-sonnet-4-20250514'`
  - `normalizeModel('unknown-model')` → `'unknown-model'` (Fallback)
- `npx tsc --noEmit` + `npm run test` fehlerfrei

**Komplexität:** S (1-3h)  
**Parallelisierbar:** Nein (benötigt 21.1 — baut auf Konstanten auf)

### Task 21.3: `model-fallback-chain` — Automatische Fallback-Chain

**Beschreibung:** Automatisches Fallback zu alternativen Models bei temporären Ausfällen. Bei HTTP 404/429/503 oder Model-spezifischen Errors wird automatisch das nächste Model in der Fallback-Chain versucht. Cooldown-Management verhindert wiederholte Anfragen an ausgefallene Models. Observability via Event Bus.

**Dateien erstellt/geändert:**
- `src/llm/model-constants.ts` (erweitert — Fallback-Config)
- `src/llm/model-fallback.ts` (neu — Fallback-Logik + Cooldown-State)
- `src/llm/anthropic-client.ts` (erweitert — Retry-Logic in sendMessage)
- `src/llm/error-classification.ts` (neu — HTTP-Error → Fallback-Trigger)
- `src/llm/model-fallback.test.ts` (neu — Integration-Tests mit Mock-Errors)

**Code-Beispiel** (`model-constants.ts` Erweiterung):
```typescript
export const MODEL_FALLBACKS: Record<ModelName, ModelName[]> = {
  'claude-opus-4-20250514': ['claude-sonnet-4-20250514', 'claude-haiku-4-20250514'],
  'claude-sonnet-4-20250514': ['claude-haiku-4-20250514'],
  'claude-haiku-4-20250514': [], // Kein Fallback
};
```

**Code-Beispiel** (`model-fallback.ts` Interface):
```typescript
export class ModelFallbackManager {
  private cooldowns = new Map<ModelName, number>(); // model → cooldown_until_timestamp
  
  async executeWithFallback<T>(
    model: ModelName,
    executor: (model: ModelName) => Promise<T>
  ): Promise<{ result: T; usedModel: ModelName }> {
    const chain = [model, ...(MODEL_FALLBACKS[model] ?? [])];
    // Try-catch Loop mit exponential backoff
    // Event-Emitting: model_fallback, model_cooldown
  }
  
  isInCooldown(model: ModelName): boolean {
    // Check ob model aktuell in Cooldown
  }
  
  setCooldown(model: ModelName, durationMs: number): void {
    // Cooldown-Timer setzen
  }
}
```

**Acceptance Criteria:**
- Error-Classification implementiert: HTTP 404/429/503 triggern Fallback
- Fallback-Chain wird sequentiell durchlaufen bei Fehlern
- Exponential Backoff zwischen Retries (1s, 2s, 4s)
- Cooldown-State: ausgefallene Models werden 5 Minuten gesperrt (in-memory Map)
- Event-Emitting via Event Bus (aus Epic 2):
  - `model_fallback` Event: `{ original: ModelName, fallback: ModelName, reason: string }`
  - `model_cooldown` Event: `{ model: ModelName, until: number }`
  - `model_recovered` Event: `{ model: ModelName }`
- Integration in `AnthropicClient.sendMessage()`: nutzt `ModelFallbackManager`
- Integration-Tests mit Mock HTTP-Errors:
  - Szenario 1: Opus 404 → Fallback zu Sonnet → Erfolg
  - Szenario 2: Opus 429 → Cooldown → zweiter Request überspringt Opus
  - Szenario 3: Alle Models 503 → Error nach allen Fallbacks
- `npx tsc --noEmit` + `npm run test` fehlerfrei
- Event Bus Logger zeigt Fallback-Events

**Komplexität:** M (4-8h)  
**Parallelisierbar:** Nein (benötigt 21.1 + 21.2 — nutzt Konstanten + Normalisierung)

## Parallelisierungs-Plan

```
Wave 1 (sequentiell):
  Task 21.1 (model-constants)        ──

Wave 2 (sequentiell):
  Task 21.2 (model-aliases)          ──

Wave 3 (sequentiell):
  Task 21.3 (model-fallback-chain)   ──
```

## Agent-Bedarf
- **1 Worker** (streng sequentiell — Tasks bauen aufeinander auf)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test`
- Alle Tests grün (Unit + Integration)
- Event Bus Logger zeigt Fallback-Events korrekt
- Keine hardcoded Model-Strings mehr im Codebase (außer in model-constants.ts)
- Cooldown-State funktioniert korrekt (manuelle Tests mit Mock-Errors)

## Offene Fragen / Risiken
- **Persistentes Cooldown-State:** Aktuell in-memory (Map). Bei Process-Restart geht State verloren. Für MVP ausreichend, spätere Iteration könnte Cooldown in `~/.workbench/model-state.json` persistieren.
- **Fallback-Strategie:** Chain ist statisch definiert (Opus → Sonnet → Haiku). Dynamische Strategien (z.B. basierend auf Task-Komplexität) könnten später kommen.
- **Rate-Limit-Handling:** 429 Errors triggern Fallback, könnten aber auch ein Zeichen für generelles Rate-Limiting sein (nicht Model-spezifisch). Initial: Fallback probieren, bei wiederholtem 429 auf allen Models → Error.
- **Setup-Token-Support:** NICHT im Scope dieses Epics. Setup-Tokens (falls überhaupt nötig) wären ein separates Epic. Workbench nutzt bereits OAuth (Epic 1B).
