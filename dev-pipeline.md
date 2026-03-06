# Dev Pipeline Skill - Zusammenfassung

## Übersicht

Der **Dev Pipeline Skill** ist ein generisches Entwicklungs-Workflow-System für Coding-Tasks mit strikter Definition of Done (DoD) und automatisiertem PR-Flow. Es basiert auf isolierten Git-Worktrees und Epic-Branches.

---

## Kernkonzepte

### 1. Worktree-basierte Isolation
- Jeder Task läuft in einem **eigenen Git-Worktree** (separate Arbeitsverzeichnisse)
- Verhindert Konflikte zwischen parallelen Tasks
- Ermöglicht unabhängiges Arbeiten mehrerer Agents

### 2. Definition of Done (DoD)
- **Pflicht-Checks** vor jedem PR/Merge
- Konfigurierbar pro Projekt (TypeScript-Kompilierung, Tests, Build)
- Auto-Commit nach erfolgreichem DoD-Check

### 3. Epic-Branch-Flow
- Für **Multi-Task-Features** mit abhängigen Waves
- Epic-Branch sammelt mehrere Task-Branches
- Finale Epic-PR merged alles auf einmal

---

## Wann nutzen?

✅ **Nutzen für:**
- Coding-Tasks in Projekten mit `.openclaw-dev.json`
- Features, Bugfixes, Refactoring
- Multi-Task-Features (Epic-Flow)
- Code-Reviews mit Feedback-Loop

❌ **NICHT nutzen für:**
- Schnelle Fixes ohne DoD-Check
- Projekte ohne `.openclaw-dev.json`
- Reine Doku-Änderungen

---

## Workflows

### Single-Task-Flow (einfache Features)

**Ablauf:**
```bash
REPO=/root/.openclaw/projects/<project-name>

# 1. Setup: Worktree erstellen
project-task.sh $REPO setup <task-id>

# 2. Coder-Agent spawnen
sessions_spawn: coder-<task-id>

# 3. WARTEN bis Coder fertig (Worker-Polling!)

# 4. DoD-Check + PR erstellen
project-task.sh $REPO check <task-id>
project-task.sh $REPO pr <task-id> "<description>"

# 5. Reviewer-Agent spawnen
sessions_spawn: reviewer-<task-id>

# 6. WARTEN bis Review fertig

# 7. Cleanup nach PR-Merge
project-task.sh $REPO cleanup <task-id>
```

---

### Epic-Branch-Flow (Multi-Task-Features)

**Wann:** Feature besteht aus mehreren abhängigen Tasks (Wave 1 → Wave 2 → Wave 3)

**Beispiel:** UI-Rewrite mit Svelte 5
- Wave 1: Basis-Components
- Wave 2: Forms + State (benötigt Wave 1)
- Wave 3: Integration (benötigt Wave 1+2)

**Ablauf:**
```bash
REPO=/root/.openclaw/projects/<project-name>

# 1. Epic-Branch erstellen
project-task.sh $REPO epic <epic-id>

# 2. Wave 1 Setup (basiert auf Epic)
project-task.sh $REPO setup wave1 --base epic/<epic-id>
sessions_spawn: coder-wave1

# 3. WARTEN bis coder-wave1 fertig!

# 4. Check + Merge in Epic
project-task.sh $REPO check wave1
project-task.sh $REPO epic-merge wave1 <epic-id>

# 5. Wave 2 Setup (basiert auf Epic mit Wave 1)
project-task.sh $REPO setup wave2 --base epic/<epic-id>
sessions_spawn: coder-wave2

# 6. WARTEN bis coder-wave2 fertig!

# 7. Check + Merge
project-task.sh $REPO check wave2
project-task.sh $REPO epic-merge wave2 <epic-id>

# 8. Weitere Waves... (repeat)

# N-1. Epic validieren (PFLICHT!)
project-task.sh $REPO epic-validate <epic-id>

# N. Epic-PR erstellen
project-task.sh $REPO epic-pr <epic-id> "<description>"

# Nach PR-Merge: Cleanup
project-task.sh $REPO cleanup wave1
project-task.sh $REPO cleanup wave2
git push origin --delete epic/<epic-id>
```

---

## Coder-Spawn-Template (STRICT!)

**KRITISCH:** Coder-Prompts MÜSSEN diese exakte Struktur haben!

```yaml
sessions_spawn:
  agentId: coder
  label: coder-<task-id>
  task: |
    ## ⚠️ WORKDIR (PFLICHT — nur hier arbeiten!) ⚠️
    <worktree-pfad aus setup-output>
    
    ## TASK
    <kurze Beschreibung was gebaut werden soll>
    
    ## DATEIEN DIE DU ÄNDERST/ERSTELLST
    - src/lib/components/NewComponent.svelte
    - src/routes/+page.svelte
    - src/lib/types.ts
    
    ## ACCEPTANCE CRITERIA
    - Komponente rendert ohne Errors
    - TypeScript kompiliert ohne Fehler
    - npm run build läuft durch
    
    ## REFERENZ-DATEIEN (nur lesen!)
    - src/lib/components/ExistingComponent.svelte
    
    ## KONTEXT (Projekt-spezifisch)
    <coder_context aus .openclaw-dev.json hier einfügen>
    
    ## REGELN (NICHT VERHANDELBAR)
    - Arbeite NUR im Workdir oben — cd dorthin als ERSTES
    - Erstelle/ändere NUR die genannten Dateien
    - Commit NICHT — das macht das Pipeline-Script
    - Lösche KEINE bestehenden Dateien außer explizit genannt
    - Wenn du unsicher bist: FRAGE statt raten
```

**Warum so strikt?**
- Ohne explizites Workdir arbeiten Coder im falschen Repo
- Ohne Dateiliste ändern sie unkontrolliert Dateien
- Ohne Commit-Verbot brechen sie den Git-Flow

---

## Scripts

### project-task.sh

**Pfad:** `/root/.openclaw/scripts/project-task.sh`

**Usage:** `project-task.sh <repo-path> <action> <task-id> [options]`

#### Standard Flow Actions

| Action | Beschreibung | Beispiel |
|--------|-------------|----------|
| `setup <task-id> [--base <branch>]` | Worktree erstellen oder wiederverwenden | `setup fix-sidebar --base epic/ui-rewrite` |
| `check <task-id>` | DoD prüfen + Auto-Commit | `check fix-sidebar` |
| `pr <task-id> "<desc>"` | PR erstellen (nach DoD) | `pr fix-sidebar "Fix sidebar overflow"` |
| `rebase <task-id>` | Rebase auf base branch | `rebase fix-sidebar` |
| `review-fix <task-id>` | PR-Kommentare zeigen | `review-fix fix-sidebar` |
| `cleanup <task-id>` | Worktree + Branch löschen | `cleanup fix-sidebar` |

#### Epic Flow Actions

| Action | Beschreibung | Beispiel |
|--------|-------------|----------|
| `epic <epic-id>` | Epic-Branch erstellen | `epic ui-rewrite` |
| `epic-merge <task-id> <epic-id>` | Task in Epic mergen | `epic-merge wave1 ui-rewrite` |
| `epic-validate <epic-id>` | Full build + test auf epic | `epic-validate ui-rewrite` |
| `epic-pr <epic-id> "<desc>"` | Epic-PR erstellen | `epic-pr ui-rewrite "Complete UI rewrite"` |

#### Script-Features

**Setup:**
- Erstellt Worktree von base branch (default: `origin/main`)
- Installiert Dependencies (pnpm)
- Optimiert node_modules (Symlink wenn package.json identisch)
- Symlinkt .env aus Repo

**Check:**
- Führt `pre_dod` Commands aus (Setup)
- Führt `dod` Commands aus (TypeScript, Build, Tests)
- Auto-Commit nach erfolgreichem DoD
- Erstellt `.dod-passed` Flag

**Epic-Merge:**
- Merged Task-Branch in Epic-Branch
- Erkennt Fast-Forward vs. Merge-Konflikte
- Gibt detaillierte Konflikt-Anweisungen

**Epic-Validate:**
- Checkout + Pull Epic-Branch
- Install + Build + Test
- Parst Test-Output (passed/failed/skipped)

---

### project-release.sh

**Pfad:** `/root/.openclaw/scripts/project-release.sh`

**Usage:** `project-release.sh <repo-path> [--skip-e2e]`

**NIEMALS eigenständig ausführen** — nur auf User-Anfrage!

#### Release-Schritte

1. **E2E Tests** (optional mit `--skip-e2e`)
   - Playwright-Tests ausführen
   - Abort bei Failure

2. **Git Fetch + Check**
   - Prüft ob `base_branch` Commits vor `main` hat
   - Exit wenn nichts zu releasen

3. **Merge base_branch → main**
   - Automatischer Merge
   - Abort bei Konflikten (manuelles Resolve nötig)

4. **Install + Build**
   - `npm ci --production=false`
   - Build-Command aus Config
   - Revert bei Failure

5. **Deploy**
   - PM2-Restart (wenn `pm2_name` konfiguriert)
   - Health-Check

6. **Push**
   - Push main zu origin

**Safety:** Auto-Rollback bei Build-Fehler

---

## Config: `.openclaw-dev.json`

Jedes Projekt braucht diese Datei im Repo-Root:

```json
{
  "name": "my-project",
  "gh_repo": "user/my-project",
  "base_branch": "develop",
  "worktree_base": "/tmp/my-project-worktrees",
  "pre_dod": ["optional setup commands"],
  "dod": [
    "npx tsc --noEmit",
    "npm run build"
  ],
  "coder_context": "Projektspezifischer Kontext für Coder-Agents...",
  "reviewer_focus": [
    "TypeScript",
    "Security",
    "Logik"
  ],
  "release": {
    "pm2_name": "my-project-prod",
    "build_cmd": "npm run build"
  },
  "urls": {
    "prod": "https://...",
    "staging": "https://..."
  }
}
```

### Config-Felder

| Feld | Pflicht | Beschreibung |
|------|---------|--------------|
| `name` | ✅ | Projekt-Name |
| `gh_repo` | ✅ | GitHub Repo (`user/repo`) |
| `base_branch` | ⚠️ | Branch für PRs (default: `main`) |
| `worktree_base` | ⚠️ | Worktree-Verzeichnis (default: `/tmp/<name>-worktrees`) |
| `pre_dod` | ❌ | Commands vor DoD (z.B. Setup) |
| `dod` | ✅ | DoD-Commands (TypeScript, Build, Tests) |
| `coder_context` | ✅ | Kontext für Coder-Agents (Architektur, Patterns) |
| `reviewer_focus` | ✅ | Review-Fokus-Bereiche |
| `release.pm2_name` | ❌ | PM2-Prozess-Name für Auto-Restart |
| `release.build_cmd` | ⚠️ | Build-Command (default: `npm run build`) |
| `urls` | ❌ | Prod/Staging URLs |

---

## Regeln (Enforcement)

### Pflicht

- ✅ **Nie direkt im Repo editieren** — immer Worktree
- ✅ **Ein Task = ein Branch = ein PR** (Epic = mehrere Tasks)
- ✅ **DoD ist Pflicht** — kein PR/epic-merge ohne grünes `check`
- ✅ **Coder-Template MUSS verwendet werden**
- ✅ **Task-IDs:** Kurz, beschreibend (`fix-sidebar`, `wave1-components`)

### Verboten

- ❌ **Kein Release ohne User-Anfrage**
- ❌ **Kein Cleanup vor epic-merge** (bei Epic-Flow)
- ❌ **Kein Commit durch Coder**

### Epic-Spezifisch

- ✅ **Epic-Branch nie direkt bearbeiten** — nur via epic-merge
- ✅ **Cleanup erst nach epic-pr** — nicht nach jedem Wave
- ✅ **Wave-Tasks brauchen `--base epic/<epic-id>`**

---

## Troubleshooting

| Problem | Ursache | Lösung |
|---------|---------|--------|
| "Worktree existiert nicht" | `setup` vergessen oder cleanup zu früh | `setup` erneut ausführen |
| "DoD failed" | Coder hat Fehler gebaut | Logs prüfen → review-fix oder neuer Coder |
| "Epic branch nicht gefunden" | `epic <epic-id>` vergessen | Epic-Branch erstellen |
| "Merge conflicts" | Branch veraltet | `rebase <task-id>` ausführen |
| "Coder arbeitet im falschen Dir" | Template nicht verwendet | Coder-Template strikt befolgen |

---

## Best Practices

### Epic vs Single
- **Epic:** Nur wenn Tasks wirklich aufeinander aufbauen
- **Single:** Bei parallelen oder unabhängigen Tasks

### Task-Granularität
- **Ein Task = 1-3 Dateien**
- **Nicht:** "rewrite entire app" in einem Task
- **Besser:** Aufteilen in logische Waves

### Code-Review
- **Immer Reviewer nutzen** — auch bei eigenen Tasks
- Fresh-Eyes-Prinzip verhindert blinde Flecken

### DoD-Strenge
- **Lieber zu streng als zu lasch**
- Kaputte PRs kosten mehr Zeit als strikte DoD-Checks

### Coder-Context
- **Aktuell halten** in `.dev-pipeline.json`
- Bei Architektur-Änderungen updaten

---

## Vollständiges Epic-Beispiel

**Szenario:** Dashboard-UI-Rewrite mit Svelte 5

```bash
REPO=/root/.openclaw/projects/ai-agent

# Epic erstellen
project-task.sh $REPO epic ui-rewrite

# Wave 1: Basis-Components (Button, Input, Card)
project-task.sh $REPO setup wave1-base --base epic/ui-rewrite
sessions_spawn(coder-wave1, runTimeoutSeconds: 900)

# POLLING für coder-wave1
while true; do
  sleep 30
  status=$(subagents list | grep coder-wave1 | awk '{print $2}')
  [[ "$status" == "done" ]] && break
  [[ "$status" == "failed" ]] && exit 1
done

# Wave 1 verarbeiten
project-task.sh $REPO check wave1-base
project-task.sh $REPO epic-merge wave1-base ui-rewrite

# Wave 2: Forms (nutzt Wave 1)
project-task.sh $REPO setup wave2-forms --base epic/ui-rewrite
sessions_spawn(coder-wave2, runTimeoutSeconds: 900)

# POLLING für coder-wave2
while true; do
  sleep 30
  status=$(subagents list | grep coder-wave2 | awk '{print $2}')
  [[ "$status" == "done" ]] && break
  [[ "$status" == "failed" ]] && exit 1
done

# Wave 2 verarbeiten
project-task.sh $REPO check wave2-forms
project-task.sh $REPO epic-merge wave2-forms ui-rewrite

# Wave 3: Integration
project-task.sh $REPO setup wave3-integration --base epic/ui-rewrite
sessions_spawn(coder-wave3, runTimeoutSeconds: 900)

# POLLING für coder-wave3
while true; do
  sleep 30
  status=$(subagents list | grep coder-wave3 | awk '{print $2}')
  [[ "$status" == "done" ]] && break
  [[ "$status" == "failed" ]] && exit 1
done

# Wave 3 verarbeiten
project-task.sh $REPO check wave3-integration
project-task.sh $REPO epic-merge wave3-integration ui-rewrite

# Epic validieren
project-task.sh $REPO epic-validate ui-rewrite

# Epic-PR erstellen
project-task.sh $REPO epic-pr ui-rewrite "Complete UI rewrite with Svelte 5"

# Nach PR-Merge: Cleanup
project-task.sh $REPO cleanup wave1-base
project-task.sh $REPO cleanup wave2-forms
project-task.sh $REPO cleanup wave3-integration
git push origin --delete epic/ui-rewrite

# Finaler Report
sessions_send(message="[REPORT:DONE] Epic ui-rewrite complete")
```

