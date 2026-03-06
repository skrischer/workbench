# Anthropic OAuth Provider - Technische Dokumentation

## Übersicht

Der Anthropic OAuth Provider ermöglicht die Authentifizierung mit **Claude Consumer-Konten** (Claude Max/Pro) über OAuth 2.0 mit PKCE. Dies unterscheidet sich vom Standard-API-Provider, der nur mit Anthropic API Keys funktioniert.

## OAuth 2.0 Konfiguration

```
Client ID:     9d1c250a-e61b-44d9-88ed-5944d1962f5e
Authorize URL: https://claude.ai/oauth/authorize
Token URL:     https://console.anthropic.com/v1/oauth/token
Redirect URI:  https://console.anthropic.com/oauth/code/callback
Scopes:        org:create_api_key user:profile user:inference
Method:        PKCE (Proof Key for Code Exchange)
```

## Token-Erzeugung (OAuth Flow)

### 1. PKCE-Parameter Generierung

```
1. Generiere 32 zufällige Bytes
2. Erstelle Verifier: Base64URL-Encoding der Bytes
3. Erstelle Challenge: SHA256-Hash des Verifiers, Base64URL-encoded
```

### 2. Authorization Request

Der User wird zu folgender URL geleitet:

```
https://claude.ai/oauth/authorize?
  code=true&
  client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&
  response_type=code&
  redirect_uri=https://console.anthropic.com/oauth/code/callback&
  scope=org:create_api_key user:profile user:inference&
  code_challenge=<BASE64URL_ENCODED_SHA256>&
  code_challenge_method=S256&
  state=<VERIFIER>
```

**Wichtig**: Der `state` Parameter enthält den PKCE Verifier selbst.

### 3. Callback & Code Extraction

Nach Benutzerautorisierung wird zu Redirect URI geleitet:
```
https://console.anthropic.com/oauth/code/callback?code=<CODE>&state=<STATE>
```

Der User kopiert den `code#state` String (Format: `<CODE>#<STATE>`).

### 4. Token Exchange

POST Request zu Token-Endpoint:

```json
{
  "grant_type": "authorization_code",
  "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  "code": "<CODE>",
  "state": "<STATE>",
  "redirect_uri": "https://console.anthropic.com/oauth/code/callback",
  "code_verifier": "<VERIFIER>"
}
```

**Response**:
```json
{
  "access_token": "sk-ant-oat01-...",
  "refresh_token": "sk-ant-ort01-...",
  "expires_in": 3600
}
```

### 5. Token-Speicherung

**Ablaufzeit-Berechnung**:
```typescript
const expiresAtMs = Date.now() + (expires_in * 1000) - (5 * 60 * 1000)
// Aktueller Timestamp + Gültigkeitsdauer - 5 Minuten Puffer
```

## Token-Speicherung

### Dateistruktur

```json
{
  "anthropic": {
    "type": "oauth",
    "refresh": "sk-ant-ort01-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "access": "sk-ant-oat01-YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY",
    "expires": 1709672400000
  }
}
```

### Token-Präfixe

- **Access Token**: `sk-ant-oat01-` (OAuth Access Token)
- **Refresh Token**: `sk-ant-ort01-` (OAuth Refresh Token)
- **Setup Token**: `sk-ant-oat01-` (alternatives Format, mind. 80 Zeichen)

## Token Refresh-Mechanismus

### Refresh-Trigger

Token werden automatisch erneuert:
- **Vor jedem API-Request**: Proaktive Prüfung ob Token abgelaufen
- **Bedingung**: `Date.now() >= expires`
- **Mit File-Lock**: Verhindert parallele Refresh-Aufrufe

### Ablauf

**Schritt 1: Prüfe Token-Gültigkeit**
```
if (Date.now() < expires) {
  // Token noch gültig, verwende existierenden Access-Token
  return access_token
}
```

**Schritt 2: File-Lock setzen**
- Verhindert parallele Refresh-Versuche
- Race Conditions werden vermieden
- Retries bei Lock-Konflikt

**Schritt 3: Token Refresh durchführen**

### Refresh Request

POST zu `https://console.anthropic.com/v1/oauth/token`:

```json
{
  "grant_type": "refresh_token",
  "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  "refresh_token": "sk-ant-ort01-..."
}
```

**Response**:
```json
{
  "access_token": "sk-ant-oat01-...",
  "refresh_token": "sk-ant-ort01-...",  // Optional, kann gleichbleiben
  "expires_in": 3600
}
```

**Schritt 4: Neue Tokens speichern**
```
expiresAtMs = now + (expires_in * 1000) - (5 * 60 * 1000)
```
- Ablaufzeit = Jetzt + Gültigkeitsdauer - 5 Minuten Puffer
- 5-Minuten-Puffer verhindert Token-Expiry während Requests

## Refresh-Zyklus in der Anwendung

### Wann wird geprüft?

**Bei jedem API-Request**:
1. Vor Ausführung des Requests wird Token-Ablaufzeit geprüft
2. Falls `Date.now() >= expires`: Refresh-Flow wird getriggert
3. Falls Token noch gültig: Direkte Verwendung

### Parallele Requests

**Problem**: Mehrere gleichzeitige API-Calls könnten parallel Token refreshen

**Lösung**: File-Lock Mechanismus
- Erster Request erhält Lock und führt Refresh durch
- Weitere Requests warten auf Lock-Release
- Nach Refresh nutzen alle Requests den neuen Token
- Retry-Logik: 5 Versuche, 100-1000ms Timeout

### Fehlerbehandlung

**Refresh-Token abgelaufen/ungültig**:
- HTTP 400/401 Response vom Token-Endpoint
- **Lösung**: OAuth-Flow muss komplett neu durchgeführt werden
- Kein automatisches Recovery möglich

**Netzwerk-Fehler**:
- Temporäre Fehler bei Token-Refresh
- **Lösung**: Request-Retry oder manuelle Wiederholung

## PKCE-Sicherheit

**Proof Key for Code Exchange** schützt vor Authorization Code Interception:

1. **Verifier** wird lokal generiert und nie übertragen
2. **Challenge** (SHA256-Hash des Verifiers) wird bei Authorization gesendet
3. Bei Token-Exchange wird Verifier validiert
4. Nur wer den Verifier kennt, kann Tokens erhalten

**Vorteil**: Selbst wenn der Authorization Code abgefangen wird, kann ohne Verifier kein Token erzeugt werden

## Troubleshooting

### Token-Refresh schlägt fehl

**Symptom**: 401/403 bei API-Requests trotz gespeichertem Refresh-Token

**Mögliche Ursachen**:
- Refresh-Token abgelaufen (typischerweise nach mehreren Monaten)
- Refresh-Token wurde serverseitig invalidiert
- Netzwerk-Fehler beim Refresh-Request

**Lösung**: OAuth-Flow komplett neu durchführen

### PKCE State Mismatch

**Symptom**: "missing or invalid code/state" beim Token-Exchange

**Ursachen**: 
- Falscher `code#state` kopiert
- PKCE Verifier stimmt nicht mit State überein
- Code bereits verwendet oder abgelaufen

**Lösung**: OAuth-Flow neu starten

### Parallele Refresh-Versuche

**Symptom**: Intermittierende Token-Fehler bei hoher Last

**Ursache**: Mehrere Prozesse/Threads versuchen gleichzeitig zu refreshen

**Lösung**: File-Lock implementieren (siehe Refresh-Mechanismus)

## Zusammenfassung

### Token-Erzeugung
1. PKCE-Parameter generieren (Verifier + Challenge)
2. User zu `claude.ai/oauth/authorize` leiten
3. User autorisiert und erhält `code#state`
4. Code gegen Tokens tauschen via `/v1/oauth/token`
5. Access- und Refresh-Token speichern

### Token-Refresh
1. **Trigger**: Vor jedem API-Request, wenn `Date.now() >= expires`
2. **File-Lock**: Verhindert parallele Refresh-Versuche
3. **Request**: POST zu `/v1/oauth/token` mit Refresh-Token
4. **Speichern**: Neue Tokens mit aktualisierter Ablaufzeit
5. **Puffer**: 5 Minuten vor tatsächlichem Ablauf

### Kernmerkmale
- **PKCE OAuth 2.0** für sichere Authentifizierung
- **Automatischer Refresh** bei jedem API-Request
- **Consumer-Endpunkte**: `claude.ai` statt API-Endpunkte
- **Zugriff**: Persönliche Claude Max/Pro Konten
- **Token-Typen**: Access (`sk-ant-oat01-`), Refresh (`sk-ant-ort01-`)
