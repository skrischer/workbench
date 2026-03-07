# Epic X: epic-id — Kurzbeschreibung

## Ziel
Kompakte Beschreibung des Epic-Zwecks. Was wird erreicht/gebaut?

## Abhängigkeiten
- Epic Y (name) — Was wird aus diesem Epic benötigt
- Epic Z (name) — Weitere Abhängigkeit
- Keine — Falls dies das Fundament ist

## Tasks

### Task X.1: `task-id` — Task-Titel

**Beschreibung:** Was wird in diesem Task implementiert? Welche Komponenten werden gebaut?

**Dateien erstellt/geändert:**
- `src/module/file.ts` (Beschreibung was die Datei macht)
- `src/module/another.ts` (Weitere Datei)
- `src/types/index.ts` (Types erweitern/erstellen)

**Optional — Code-Beispiele/Interfaces:**
```typescript
interface Example {
  field: string;
  // Erwartete Struktur
}
```

**Acceptance Criteria:**
- Funktionale Anforderung 1
- Funktionale Anforderung 2
- TypeScript kompiliert: `npx tsc --noEmit`
- Tests vorhanden und grün
- Weitere spezifische Kriterien

**Komplexität:** S / M / L  
**Parallelisierbar:** Ja/Nein (mit Bedingungen)

### Task X.2: `task-id-2` — Zweiter Task

**Beschreibung:** Weitere Task-Beschreibung

**Dateien erstellt/geändert:**
- Liste der Dateien

**Acceptance Criteria:**
- Kriterien-Liste

**Komplexität:** S / M / L  
**Parallelisierbar:** Ja/Nein (Bedingung: nach X.1, parallel zu X.3)

### Task X.3: `task-id-3` — Dritter Task

**Beschreibung:** Weitere Task-Beschreibung

**Dateien erstellt/geändert:**
- Liste der Dateien

**Acceptance Criteria:**
- Kriterien-Liste

**Komplexität:** S / M / L  
**Parallelisierbar:** Ja/Nein

## Parallelisierungs-Plan

```
Wave 1 (sequentiell):
  Task X.1 (task-name)        ──

Wave 2 (parallel):
  Task X.2 (task-name)        ──┐
  Task X.3 (task-name)        ──┘

Wave 3 (sequentiell):
  Task X.4 (task-name)        ──
```

## Agent-Bedarf
- **N Worker** (max parallel in Wave Y)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build` + `npm run test`
- Weitere spezifische DoD-Anforderungen
- Event-Map erweitern falls nötig
- Config-Anpassungen

## Offene Fragen / Risiken
- **Technische Entscheidung:** Beschreibung und Begründung
- **Bekanntes Risiko:** Was könnte schiefgehen, Mitigation
- **Zukünftige Überlegung:** Was kommt später
