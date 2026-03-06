# AI Dev OS -- Implementation Roadmap

## Phase 1 -- Minimal Agent Runtime

Ziel: funktionierender Coding-Agent.

### Komponenten

-   CLI Entry
-   Agent Runtime Loop
-   Tool System
-   Session Storage
-   Anthropic Client — OAuth 2.0 PKCE gegen Claude Max Plan, siehe `anthropic-oauth-provider.md`

### Minimaler Toolset

-   read_file
-   write_file
-   edit_file
-   exec

### Beispielstruktur

    agency/
      agent/
      tools/
      runtime/
      llm/
      cli/

### Erfolgskriterium

    agency run "create a hello world server"

Der Agent kann:

-   Dateien erstellen
-   Code schreiben
-   Code ausführen
-   Fehler korrigieren

------------------------------------------------------------------------

## Phase 2 -- Observability Layer (sehr hohe Priorität)

Agent Systeme ohne Transparenz werden schnell unbrauchbar.

Implementieren:

-   Run Logs
-   Tool Call Logs
-   Token Usage Tracking

### Run Struktur

    runs/
      run_id/
        messages.json
        tool_calls.json

------------------------------------------------------------------------

## Phase 3 -- Codebase Intelligence (hoch)

Der Agent muss Projekte navigieren können.

Neue Tools:

-   search_code
-   list_files
-   grep
-   project_summary

Optional:

-   code_index

------------------------------------------------------------------------

## Phase 4 -- Task System (hoch)

Komplexe Aufgaben strukturieren.

Neue Primitives:

-   Task
-   Plan
-   Step

Fähigkeiten:

-   Planung
-   Fortschrittskontrolle
-   Wiederaufnahme

------------------------------------------------------------------------

## Phase 5 -- Dev Dashboard (hoch)

Weboberfläche für Systemkontrolle.

Funktionen:

-   Session Viewer
-   Tool Call Viewer
-   Diff Viewer
-   Run Controls

------------------------------------------------------------------------

## Phase 6 -- Multi-Agent Support (mittel)

Erweiterung um mehrere Agenten.

Neue Tools:

-   spawn_agent
-   send_message
-   list_agents

Typisches Setup:

Planner Agent Worker Agent

------------------------------------------------------------------------

## Phase 7 -- Memory System (mittel)

Langfristiges Projektwissen.

Typen:

-   session memory
-   project memory
-   knowledge memory

Implementierung:

-   vector database
-   summarised session history
-   documentation memory

------------------------------------------------------------------------

## Phase 8 -- Safety & Self‑Modification (hoch)

Wenn Agenten das System verändern dürfen:

-   git enforced workflow
-   diff review
-   rollback

Siehe `dev-pipeline.md` für den vollständigen Worktree/Epic-Branch-Flow mit DoD-Enforcement und Coder/Reviewer-Orchestrierung.

------------------------------------------------------------------------

## Phase 9 -- Autonomous Dev Workflows (mittel)

Automatisierte Entwicklungsprozesse.

Beispiele:

-   test fixing agent
-   code review agent
-   refactor agent
-   documentation agent

------------------------------------------------------------------------

## Zielzustand

    AI Dev OS
     ├ CLI
     ├ Agent Runtime
     ├ Tool System
     ├ Dev Dashboard
     ├ Task System
     └ Project Memory

Typischer Workflow:

    agency plan "add authentication"
    agency run plan-42

Der Agent:

1.  erstellt Plan
2.  implementiert Code
3.  führt Tests aus
4.  präsentiert Änderungen

Der Entwickler überprüft und entscheidet.
