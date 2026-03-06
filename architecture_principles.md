# AI Dev OS -- Architecture Principles

## Vision

Ein persönliches **AI Dev OS**: ein Developer-Tooling-System mit
Agent-Interface. Der Agent ist kein autonomes System, sondern ein
Werkzeug zur Durchführung von Entwicklungsarbeit.

Ziel ist ein System, das:

-   Code schreiben kann
-   Projekte verstehen kann
-   Aufgaben planen und ausführen kann
-   als Erweiterung des Entwickler-Workflows funktioniert

Der Entwickler bleibt der Entscheider. Der Agent ist der Operator.

------------------------------------------------------------------------

## System Constraints

-   Single user system
-   Läuft auf einem VPS
-   Zugriff nur über private Verbindung (z. B. Tailscale)
-   Kein Multi‑Tenant Design
-   Kein SaaS Modell
-   Kein öffentliches API als Kernanforderung

Das System ist ein **persönliches Entwicklungswerkzeug**.

------------------------------------------------------------------------

## Core Primitives

Die Architektur basiert auf wenigen stabilen Kernbausteinen.

### Agent

Konfiguration eines LLM‑basierten Operators.

Eigenschaften:

-   model
-   system_prompt
-   tools
-   max_steps

------------------------------------------------------------------------

### Tool

Standardisierte Schnittstelle für Aktionen.

    Tool
    - name
    - description
    - input_schema
    - execute()

Alle Systemfähigkeiten entstehen über Tools.

------------------------------------------------------------------------

### Session

Kontext einer Aufgabe.

Speichert:

-   Nachrichten
-   Tool Calls
-   Status

Sessions ermöglichen Debugging und Wiederaufnahme.

------------------------------------------------------------------------

### Run

Ein konkreter Agentdurchlauf.

Eigenschaften:

-   start state
-   tool history
-   final result

Runs sind vollständig logbar.

------------------------------------------------------------------------

### Task

Strukturierte Aufgabenbeschreibung.

Ein Task kann bestehen aus:

-   Plan
-   Steps
-   Subtasks

------------------------------------------------------------------------

## Agent Runtime Philosophy

Der Agent arbeitet **nicht autonom**, sondern in einem kontrollierten
Loop.

Grundstruktur:

    while not finished
      call LLM
      if tool requested
        execute tool
        append result
      else
        return response

Eigenschaften:

-   deterministischer Ablauf
-   maximale Schrittzahl
-   vollständige Historie

------------------------------------------------------------------------

## Tool System Design

Alle Fähigkeiten werden über Tools bereitgestellt.

Beispiele:

-   read_file
-   write_file
-   edit_file
-   exec
-   search_code
-   list_files

Das System bleibt dadurch modular.

------------------------------------------------------------------------

## Observability Requirements

Agent Systeme müssen vollständig beobachtbar sein.

Wichtige Anforderungen:

-   vollständige Run Logs
-   Tool Call History
-   Token Usage
-   Laufzeiten

Ohne Observability wird Debugging schwierig.

------------------------------------------------------------------------

## Safety Principles

Wenn Agenten Code ausführen oder verändern dürfen, sind
Schutzmechanismen notwendig.

Empfohlene Prinzipien:

-   git enforced commits
-   diff visibility
-   rollback capability

------------------------------------------------------------------------

## Extension Model

Das System wird nicht über Framework‑Plugins erweitert, sondern über:

-   neue Tools
-   neue Agent Configs
-   neue Runtime Primitives

Neue Fähigkeiten entstehen durch Kombination vorhandener Bausteine.
