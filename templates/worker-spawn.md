# Worker/Coder Spawn Template

Verwende dieses Template wenn ein Lead einen Coder-Worker für einen Task spawnt.

## Template

```
## Task: {TASK_ID} — {TASK_TITLE}

### Epic
{EPIC_ID}: {EPIC_TITLE}

### Repo
`/root/.openclaw/projects/workbench/`

### Dev-Pipeline (PFLICHT!)
REPO=/root/.openclaw/projects/workbench
SCRIPT=/root/.openclaw/scripts/project-task.sh

# 1. Worktree erstellen
$SCRIPT $REPO setup {TASK_ID}

# 2. Implementiere im Worktree
cd /tmp/workbench-worktrees/{TASK_ID}/

# 3. DoD prüfen
$SCRIPT $REPO check {TASK_ID}

# 4. PR erstellen
$SCRIPT $REPO pr {TASK_ID} "{PR_DESCRIPTION}"

### Coder Context
TypeScript ESM project (Node.js 22+). Uses vitest for tests. Strict mode enabled.
Module resolution: NodeNext. All imports need .js extension.
Existing types in src/types/index.ts. Follow the Tool interface pattern from
architecture_principles.md.

### Aufgabe
{DETAILLIERTE_TASK_BESCHREIBUNG}

### Dateien
- Erstellen: {FILE_LIST}
- Ändern: {FILE_LIST}

### Acceptance Criteria
{KRITERIEN_AUS_EPIC_FILE}

### Fix-while-Testing (nur bei E2E-Tasks)
Wenn ein Test failt und der Fehler im Produktionscode liegt:
1. Bug im selben Worktree fixen (NICHT separater PR)
2. Test muss grün werden
3. Commit-Message: `feat(e2e): {test description}; fix {bug description}`
4. Ausnahme: Bug in komplett anderem Bereich → `it.todo()` + separater PR

### DoD
- `npx tsc --noEmit` ✓
- `npm test` ✓
- `npm run build` ✓
- `npm run test:e2e` ✓ (wenn E2E-Infra existiert)
```

## Nutzung

```javascript
sessions_spawn({
  agentId: "coder",
  mode: "run",
  task: "<ausgefülltes Template>"
})
```
