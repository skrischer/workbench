# Epic 1B: oauth-client — Anthropic OAuth Client (manueller Token-Paste)

## Ziel
Anthropic LLM-Anbindung über OAuth Bearer Tokens. Der User autorisiert manuell im Browser (PKCE Flow auf claude.ai), kopiert Access- und Refresh-Token in eine Token-Datei. Das System kümmert sich um Token-Laden, automatischen Refresh bei Ablauf, und die Messages API.

## Abhängigkeiten
Epic 0 (bootstrap) — Projektstruktur muss existieren. Parallel zu Epic 1A möglich.

## Tasks

### Task 1B.1: `token-storage` — Token-Datei lesen/schreiben + File-Lock

**Beschreibung:** Token-Storage für die manuell gepasteten OAuth-Tokens. JSON-Datei mit access_token, refresh_token, expires (Timestamp). File-Lock für Race-Condition-Schutz bei parallelen Prozessen.

**Dateien erstellt/geändert:**
- `src/llm/token-storage.ts` (TokenStorage Klasse: load, save, isExpired, getAccessToken)
- `src/llm/file-lock.ts` (FileLock: acquire, release, withLock — .lock-File mit Retry)
- `src/types/index.ts` (TokenData Interface: `{ type: "oauth", access: string, refresh: string, expires: number }`)

**Token-Datei Format** (`~/.workbench/tokens.json`):
```json
{
  "anthropic": {
    "type": "oauth",
    "access": "sk-ant-oat01-...",
    "refresh": "sk-ant-ort01-...",
    "expires": 1709672400000
  }
}
```

**Acceptance Criteria:**
- Token-Datei wird als JSON gelesen/geschrieben (Pfad konfigurierbar, default: `~/.workbench/tokens.json`)
- `isExpired()` prüft `Date.now() >= expires`
- `FileLock` erstellt `.lock` Datei, 5 Retries mit exponential Backoff (100-1000ms)
- `FileLock` räumt Lock-Datei im `finally` auf
- Token-Schreibvorgänge nutzen File-Lock
- Klarer Error wenn Token-Datei nicht existiert
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Nein (muss zuerst)

### Task 1B.2: `token-refresh` — Automatischer Token-Refresh

**Beschreibung:** Automatischen Token-Refresh implementieren. Vor jedem API-Request: Token-Ablauf prüfen, bei Bedarf POST mit refresh_token an Anthropic Token-Endpoint, neue Tokens speichern.

**Dateien erstellt/geändert:**
- `src/llm/token-refresh.ts` (TokenRefresher: ensureValidToken)
- `src/llm/constants.ts` (OAuth-Konstanten: Client-ID, Token-URL)

**Acceptance Criteria:**
- `ensureValidToken()` gibt gültigen Access-Token zurück
- Wenn nicht abgelaufen: direkt zurückgeben
- Wenn abgelaufen: POST zu Token-Endpoint mit `{ grant_type: "refresh_token", client_id, refresh_token }`
- Neue Tokens speichern (mit 5-Min-Puffer bei expires)
- File-Lock während Refresh
- Bei Refresh-Fehler (401/400): Error "OAuth-Flow im Browser neu durchführen"
- `npx tsc --noEmit` kompiliert fehlerfrei

**Komplexität:** S
**Parallelisierbar:** Nein (nach 1B.1)

### Task 1B.3: `anthropic-client` — LLM Client mit Messages API

**Beschreibung:** Anthropic API Client: Messages API mit OAuth Bearer Token. Tool-Use Support. Native `fetch` (Node.js 22+).

**Dateien erstellt/geändert:**
- `src/llm/anthropic-client.ts` (AnthropicClient: sendMessage)
- `src/llm/index.ts` (Barrel-Export)
- `src/types/index.ts` (LLM-Types: Message, ContentBlock, ToolUseBlock, ToolResultBlock, LLMResponse, LLMConfig)

**Acceptance Criteria:**
- `sendMessage(messages, tools?, options?)` POST zu `https://api.anthropic.com/v1/messages`
- Headers: `Authorization: Bearer <token>`, `anthropic-version: 2023-06-01`
- Nutzt `TokenRefresher.ensureValidToken()` vor jedem Request
- Response-Parsing: text/tool_use content blocks, stop_reason, usage
- Fehlerbehandlung: Rate-Limit (429), Auth (401), Server (5xx)
- Model + max_tokens konfigurierbar via LLMConfig
- `npx tsc --noEmit` + `npm run build` fehlerfrei

**Komplexität:** M
**Parallelisierbar:** Nein (nach 1B.2)

## Parallelisierungs-Plan
```
Task 1B.1 (token-storage)    ──── sequentiell
    │
Task 1B.2 (token-refresh)    ──── sequentiell
    │
Task 1B.3 (anthropic-client) ──── sequentiell
```

## Agent-Bedarf
- **1 Worker** (streng sequentiell)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build`
- TokenStorage, TokenRefresher, AnthropicClient als Module importierbar

## Offene Fragen / Risiken
- **API-Endpoint:** OAuth Bearer geht an gleichen Endpoint wie API-Key, nur Auth-Header unterschiedlich.
- **Token-Setup UX:** Manuelles Editieren der JSON-Datei. CLI-Command (`workbench auth`) kann später kommen.
- **Refresh-Token-Lebensdauer:** Unklar, Erfahrungswert mehrere Monate.
- **Kein node-fetch nötig:** Node.js 22+ native fetch.
