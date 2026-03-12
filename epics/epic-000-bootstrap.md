# Epic 0: bootstrap — Project Scaffold + .openclaw-dev.json

## Ziel
Projektstruktur für `skrischer/workbench` aufsetzen: TypeScript-Projekt mit Node.js/tsx, Verzeichnisstruktur, Build-Pipeline, und `.openclaw-dev.json` für den dev-pipeline Skill.

## Abhängigkeiten
Keine — dies ist das Fundament.

## Tasks

### Task 0.1: `scaffold` — Repo Setup + Verzeichnisstruktur + Build

**Beschreibung:** Package.json, TypeScript-Config, Verzeichnisstruktur nach Roadmap, und Build-Script einrichten. Das Repo existiert bereits (Docs sind drin), also wird auf dem bestehenden Repo aufgebaut.

**Dateien erstellt/geändert:**
- `package.json` (name: `@skrischer/workbench`, type: module, scripts inkl. `build: tsc`)
- `tsconfig.json` (strict, ESNext, NodeNext, outDir: dist)
- `.gitignore` (node_modules, dist, .env, *.log, runs/)
- `src/index.ts` (Entry-Point Placeholder)
- `src/agent/index.ts` (leerer Barrel-Export)
- `src/tools/index.ts` (leerer Barrel-Export)
- `src/runtime/index.ts` (leerer Barrel-Export)
- `src/llm/index.ts` (leerer Barrel-Export)
- `src/cli/index.ts` (leerer Barrel-Export)
- `src/types/index.ts` (minimale Placeholder-Types: AgentConfig, ToolDefinition, Session, Run als leere Interfaces)
- `src/events/index.ts` (leerer Barrel-Export)
- `src/storage/index.ts` (leerer Barrel-Export)

**Acceptance Criteria:**
- `npm install` läuft fehlerfrei
- `npx tsc --noEmit` kompiliert ohne Fehler
- `npm run build` läuft durch (tsc → dist/)
- Alle `src/<module>/index.ts` existieren
- Placeholder-Types sind exportiert und importierbar

**Komplexität:** S  
**Parallelisierbar:** Nein (muss zuerst)

### Task 0.2: `dev-config` — .openclaw-dev.json + Projekt-Docs + develop Branch

**Beschreibung:** `.openclaw-dev.json` für den dev-pipeline Skill erstellen, README aktualisieren, und `develop` Branch erstellen.

**Dateien erstellt/geändert:**
- `.openclaw-dev.json`
- `README.md` (Projekt-Beschreibung, Setup, Architektur-Überblick)

**Zusätzlich:** Nach Commit auf main → `develop` Branch erstellen und pushen.

**Acceptance Criteria:**
- `.openclaw-dev.json` ist valides JSON mit allen Pflichtfeldern
- README beschreibt Vision, Tech-Stack, Projektstruktur
- `develop` Branch existiert und ist gepusht

**Komplexität:** S  
**Parallelisierbar:** Nein (nach 0.1)

## Parallelisierungs-Plan

```
Task 0.1 (scaffold)     ──── sequentiell (zuerst)
    │
Task 0.2 (dev-config)   ──── sequentiell (danach)
```

## Agent-Bedarf
- **1 Worker** (sequentiell)
- **1 Lead** zur Orchestrierung

## DoD
- `npx tsc --noEmit` + `npm run build`
- Keine Tests (Test-Framework kommt in Epic 2)

## Offene Fragen / Risiken
Keine — alle Entscheidungen sind getroffen.
