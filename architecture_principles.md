# Workbench — Architecture Principles

## Vision

Ein persönliches **AI Dev OS**: ein Developer-Tooling-System mit
Agent-Interface. Der Agent ist kein autonomes System, sondern ein
Werkzeug zur Durchführung von Entwicklungsarbeit.

Ziel ist ein System, das:

-   Code schreiben kann
-   Projekte verstehen und langfristig begleiten kann
-   Aufgaben planen und ausführen kann
-   mehrere spezialisierte Agents orchestrieren kann
-   als Erweiterung des Entwickler-Workflows funktioniert

Der Entwickler bleibt der Entscheider. Der Agent ist der Operator.

------------------------------------------------------------------------

## System Constraints

-   Single-User-System
-   Läuft auf einem VPS
-   Zugriff nur über private Verbindung (z. B. Tailscale)
-   Kein Multi-Tenant-Design
-   Kein SaaS-Modell
-   Kein öffentliches API als Kernanforderung

Das System ist ein **persönliches Entwicklungswerkzeug**.

------------------------------------------------------------------------

## Core Primitives

Die Architektur basiert auf wenigen stabilen Kernbausteinen.

### Agent

Konfiguration eines LLM-basierten Operators.

Eigenschaften:

-   model
-   system_prompt
-   tools (Whitelist)
-   max_steps

Ein Agent ist eine Konfiguration, keine Instanz. Mehrere Agents können
parallel mit unterschiedlichen Rollen existieren (→ Multi-Agent Architecture).

------------------------------------------------------------------------

### Tool

Standardisierte Schnittstelle für Aktionen.

    Tool
    - name
    - description
    - input_schema
    - execute()

Alle Systemfähigkeiten entstehen über Tools. Kein Sonderweg.

------------------------------------------------------------------------

### Session

Kontext einer Aufgabe.

Speichert:

-   Nachrichten
-   Tool Calls
-   Status

Sessions ermöglichen Debugging und Wiederaufnahme. Abgeschlossene
Sessions werden zusammengefasst und als Memory persistiert.

------------------------------------------------------------------------

### Run

Ein konkreter Agent-Durchlauf innerhalb einer Session.

Eigenschaften:

-   start state
-   tool history
-   final result

Runs sind vollständig logbar und reproduzierbar.

------------------------------------------------------------------------

### Task

Strukturierte Aufgabenbeschreibung.

Ein Task kann bestehen aus:

-   Plan
-   Steps

Steps sind die atomare Einheit der Ausführung. Sie können sequentiell
oder parallel abgearbeitet werden und decken alle Granularitätsstufen ab.

------------------------------------------------------------------------

### Memory

Langfristiges Wissen über Projekte, Entscheidungen und Kontext.

    Memory
    - type (session, project, knowledge)
    - embedding
    - content
    - metadata

Memory ermöglicht vector-basierte Suche über akkumuliertes Projektwissen.
Session-Zusammenfassungen, Architektur-Entscheidungen und gelernte Patterns
werden als Memory-Einträge persistiert und stehen session-übergreifend
zur Verfügung.

------------------------------------------------------------------------

## Event Bus

Zentrales Pub/Sub-System für alle Systemaktivitäten.

    EventBus
    - publish(topic, payload)
    - subscribe(topic, handler)
    - unsubscribe(topic, handler)

Jede relevante Systemaktivität erzeugt ein Event: Tool Calls, Run-Lifecycle,
Task-Übergänge, Fehler. Konsumenten registrieren sich deklarativ.

Architektur-Rolle:

-   **Agent Runtime** → publiziert Run- und Tool-Events
-   **Observability** → konsumiert Events für Logging und Metriken
-   **Dashboard** → empfängt Events via WebSocket Bridge in Echtzeit
-   **Workflows** → reagieren auf Events als Trigger

Kein Polling. Alle Kommunikation zwischen Subsystemen läuft event-driven.

------------------------------------------------------------------------

## Agent Runtime Philosophy

Der Agent arbeitet **nicht autonom**, sondern in einem kontrollierten Loop.

Grundstruktur:

    while not finished
      call LLM
      if tool requested
        execute tool
        append result
        publish event
      else
        return response

Eigenschaften:

-   deterministischer Ablauf
-   maximale Schrittzahl
-   vollständige Historie
-   jeder Schritt erzeugt ein Event auf dem Event Bus

------------------------------------------------------------------------

## Tool System Design

Alle Fähigkeiten werden über Tools bereitgestellt.

Beispiele:

-   read_file, write_file, edit_file
-   exec
-   search_code, list_files
-   memory_search, memory_store
-   git_commit, git_worktree

Das System bleibt dadurch modular. Neue Fähigkeiten erfordern keinen
Framework-Umbau, sondern ein neues Tool.

Siehe `tech_stack.md` für Implementierungsdetails.

------------------------------------------------------------------------

## Multi-Agent Architecture

Multi-Agent ist kein neues Primitive, sondern Komposition bestehender
Bausteine: mehrere Agent-Konfigurationen, Message-Passing zwischen
Sessions, Orchestrator/Worker-Pattern.

Prinzipien:

-   **Orchestrator** delegiert Tasks an spezialisierte Worker-Agents
-   **Worker** führen aus und reporten Ergebnisse zurück
-   Kommunikation über Message-Passing (kein Shared State)
-   In-process async — keine externe Kommunikation nötig
-   Jeder Agent hat eigene Tool-Whitelist und System-Prompt

Beispiele: ein Agent plant, ein anderer implementiert, ein dritter reviewt.

------------------------------------------------------------------------

## Observability Requirements

Agent-Systeme müssen vollständig beobachtbar sein.

Anforderungen:

-   vollständige Run Logs
-   Tool Call History mit Input/Output
-   Token Usage pro Run und Session
-   Laufzeiten und Latenz
-   Event Stream über den Event Bus

Ohne Observability wird Debugging unmöglich. Das Dashboard konsumiert
den Event Stream in Echtzeit via WebSocket.

------------------------------------------------------------------------

## Safety Principles

Wenn Agents Code ausführen oder verändern dürfen, sind
Schutzmechanismen auf mehreren Ebenen notwendig.

### Git Safety

-   git-enforced commits — jede Änderung wird committed
-   diff visibility — alle Änderungen sind nachvollziehbar
-   rollback capability — jeder Zustand ist wiederherstellbar

### Worktree-Isolation

Jeder Run arbeitet in einem physisch getrennten Git-Worktree.
Kein Agent schreibt direkt in den Hauptbranch. Isolation ist
die Grundlage für sichere parallele Arbeit.

### Branch-Guards

Tool-Level Enforcement: bestimmte Branches (z. B. `main`) sind
für direkte Schreiboperationen gesperrt. Der Agent kann nur in
seinen zugewiesenen Feature-Branch schreiben.

### DoD-Checks

Automatische Qualitätsprüfung vor Completion eines Tasks:
Linting, Tests, Type-Checks. Ein Task gilt erst als abgeschlossen,
wenn alle definierten Gates bestanden sind.

### PR-Workflow

Strukturierte Code-Review-Schnittstelle: Änderungen werden als
Pull Request eingereicht, nicht direkt gemergt. Der Entwickler
reviewt und entscheidet.

Siehe `dev-pipeline.md` für den vollständigen Workflow.

------------------------------------------------------------------------

## Extension Model

Das System wird nicht über Framework-Plugins erweitert, sondern über:

-   neue Tools
-   neue Agent-Konfigurationen
-   neue Workflows

Neue Fähigkeiten entstehen durch Kombination vorhandener Bausteine.

### Workflows

Ein Workflow ist eine benannte Agent-Konfiguration mit spezifischem
System-Prompt und Tool-Whitelist für einen wiederkehrenden Anwendungsfall.

    Workflow
    - name
    - agent_config (model, system_prompt, tools)
    - trigger (manual | event)

Beispiele:

-   **Test-Fixer** — erkennt fehlschlagende Tests, analysiert und fixt
-   **Code-Reviewer** — reviewt Diffs nach definierten Kriterien
-   **Refactoring-Agent** — führt strukturelle Verbesserungen durch

Workflows machen das Extension Model konkret: statt generischer
Agent-Konfigurationen entstehen spezialisierte, wiederverwendbare
Automatisierungen.

------------------------------------------------------------------------

## Projektstruktur

```
src/
  cli/         # CLI Commands
  runtime/     # Agent Loop, Session Management
  llm/         # LLM Client, Token Management
  tools/       # Tool-Implementierungen
  types/       # Shared Type Definitions
  storage/     # JSON/File Storage
  events/      # Event Bus
  git/         # Git Safety, Worktrees, Branch Guards
  tasks/       # Task System, Plans, Steps
  dashboard/   # HTTP + WebSocket Server
  memory/      # Vector Store, Embeddings
  workflows/   # Workflow Definitions, Runner
  agents/      # Multi-Agent Registry, Orchestration
```

Die Struktur spiegelt die Architektur: jedes Verzeichnis entspricht
einem klar abgegrenzten Verantwortungsbereich. Keine zirkulären
Abhängigkeiten zwischen Modulen.

Siehe `tech_stack.md` für Framework- und Library-Entscheidungen.

---

## Testing Strategy

### Unit Tests
- Framework: Vitest
- Location: Co-located mit Source (`__tests__/` in jedem Modul)
- Scope: Isolierte Module, keine externen Abhängigkeiten
- Run: `npm test`

### E2E Tests
- Framework: Vitest mit separatem Config (`vitest.config.e2e.ts`)
- Location: `src/test/e2e/`
- Scope: Kompiliertes CLI-Binary als Black Box
- Run: `npm run test:e2e`

### E2E Prinzipien

1. **Kein Live-LLM in Tests.** Ein Fastify-basierter Mock-Server simuliert die Anthropic Messages API. Tests sind deterministisch und kostenlos.

2. **Fixture-basiert, nicht Record&Replay.** Handgeschriebene, minimale Response-Fixtures. Wartbar und verständlich. Keine Abhängigkeit von LLM-API-Änderungen.

3. **CLI als Black Box.** E2E-Tests spawnen `workbench <command>` als Child Process. Keine Modul-Imports — getestet wird das kompilierte Artefakt, wie ein User es nutzt.

4. **Isolierte Umgebung.** Jeder Test bekommt ein eigenes Temp-Dir mit Token-Fixtures und Agent-Config. Keine Interferenz mit dem echten `~/.workbench/` Setup.

5. **Fix-while-Testing.** Wenn ein E2E-Test einen Bug aufdeckt, wird er im selben PR gefixt. Der Test IST die Regression. Kein separates Bug-Tracking.

6. **Env-Variable Overrides.** `ANTHROPIC_API_URL` und `WORKBENCH_HOME` erlauben Tests, Mock-Server und Temp-Dir zu nutzen, ohne Produktionscode zu ändern.
