# Lead Spawn Template

Verwende dieses Template wenn Main einen Domain-Lead mit einem Epic beauftragt.

## Template

```
## Aufgabe: {EPIC_TITLE}

### Epic
{EPIC_ID}: {EPIC_TITLE}
Datei: `/root/.openclaw/projects/workbench/epics/{EPIC_FILE}`

### Repo
`/root/.openclaw/projects/workbench/`

### Abhängigkeiten
{DEPENDENCY_LIST — welche Epics müssen fertig sein?}

### Tasks (Überblick)
{TASK_TABLE — ID, Titel, Komplexität, Parallelisierbar}

### Constraints
- Code-Änderungen NUR über dev-pipeline (Worktree + PR)
- Worker spawnen mit `agentId: "coder"` (NIEMALS ohne agentId!)
- Fix-while-Testing: Bugs inline fixen wenn E2E-Epic
- DoD: siehe `.openclaw-dev.json`

### Erwartetes Ergebnis
- PRs für alle Tasks (via `project-task.sh pr`)
- Report an Main: `[REPORT:DONE]` mit Status pro Task, gefundene/gefixte Bugs

### Referenzen
- Epic-File: `epics/{EPIC_FILE}`
- Spawn Template für Worker: `templates/worker-spawn.md`
- Dev-Pipeline Config: `.openclaw-dev.json`
```

## Nutzung

```javascript
sessions_send({
  sessionKey: "agent:workbench-lead:...",
  message: "<ausgefülltes Template>"
})
```
