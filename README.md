# Workbench

**AI Dev OS** — ein CLI-basiertes Entwicklungssystem mit LLM-gestützten Agenten

## Tech Stack

- **TypeScript** (strict mode)
- **Node.js 22+**
- **Commander.js** (CLI framework)
- **Fastify** (planned, web interface)

## Projektstruktur

```
src/
├── agents/       # Agent definitions and orchestration
├── cli/          # Command-line interface
├── dashboard/    # Dashboard components (planned)
├── events/       # Event system
├── git/          # Git integration
├── llm/          # LLM provider integrations
├── memory/       # Memory and context management
├── runtime/      # Runtime and execution engine
├── storage/      # Persistence layer
├── tasks/        # Task management
├── tools/        # Agent tools
├── types/        # TypeScript type definitions
└── workflows/    # Workflow definitions
```

## Setup

```bash
npm install
npm run build
```

## CLI Usage

### Workflow Commands

```bash
# Fix failing tests (auto-detect and repair)
workbench fix-tests [--filter <pattern>] [--max-attempts <n>]

# Review code changes in a branch
workbench review <branch> [--base <branch>] [--focus <area>]

# Perform code refactoring
workbench refactor <target> --type <type> [--dry-run] [--description <desc>]

# Generate or update documentation
workbench docs --type <type> [--target <path>] [--style <style>] [--update]

# List available workflows
workbench workflows

# Run a specific workflow by ID
workbench workflow run <workflow-id> [--params <json>]

# Execute a chain of workflows
workbench chain <workflow-ids> [--cwd <path>] [--params <json>]
```

### Examples

```bash
# Fix tests with maximum 3 attempts
workbench fix-tests --max-attempts 3

# Fix only tests matching pattern "auth"
workbench fix-tests --filter "auth" --max-attempts 5

# Review PR branch with security focus
workbench review feature/new-api --base main --focus security

# Refactor: extract method
workbench refactor src/utils.ts --type extract-method --description "Extract validation logic"

# Generate API documentation
workbench docs --type api --target src/api --style detailed
```

## Status

**Phase 0 — Bootstrap**

Core infrastructure setup and initial agent framework.
