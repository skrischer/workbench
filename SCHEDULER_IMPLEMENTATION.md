# Workflow Scheduler Implementation

## ✅ Completed Tasks

### 1. ScheduleConfig Type (`src/types/workflow.ts`)
Added new interface for schedule configuration:
- `id`: Unique schedule identifier
- `workflowId`: Target workflow
- `params`: Workflow parameters
- `cron`: Optional cron expression (e.g., "0 8 * * *")
- `onEvent`: Optional event trigger (e.g., "run:end")
- `enabled`: Active status
- `createdAt`, `lastRunAt`, `nextRunAt`: Timestamps

### 2. WorkflowScheduler (`src/workflows/scheduler.ts`)
Standalone scheduler module with:
- **Cron-based scheduling**: Supports interval patterns like "0 */6 * * *"
- **Event-based triggers**: Listens to EventBus events
- **Lifecycle management**: `start()` and `stop()` methods
- **CRUD operations**: Create, read, update, delete schedules
- **JSON persistence**: Survives server restarts
- **Automatic activation**: Schedules activate when enabled

### 3. Tests (`src/workflows/__tests__/scheduler.test.ts`)
Comprehensive test suite with **19 tests** covering:
1. Schedule creation (cron and event-based)
2. Input validation (workflow existence, cron syntax)
3. CRUD operations (list, get, update, delete)
4. Lifecycle management (start/stop)
5. Persistence (load/save from disk)
6. Event-based execution
7. Cron parsing and next-run calculation
8. Schedule activation/deactivation

### 4. CLI Commands (`src/cli/workflow-commands.ts`)
Extended with three new commands:

#### `workbench workflow schedule <workflow-id>`
Schedule a workflow to run on cron or event.

**Options:**
- `--cron <expression>`: Cron expression (e.g., "0 8 * * *")
- `--on-event <event>`: Event name to trigger on (e.g., "run:end")
- `--params <json>`: Workflow parameters as JSON
- `--disabled`: Create schedule but keep it disabled

**Examples:**
```bash
# Daily at 8:00 AM
workbench workflow schedule fix-tests --cron "0 8 * * *"

# Every 6 hours
workbench workflow schedule review --cron "0 */6 * * *"

# On event trigger
workbench workflow schedule review --on-event "run:end"

# With custom parameters
workbench workflow schedule fix-tests --cron "0 0 * * *" --params '{"maxAttempts":10}'
```

#### `workbench workflow schedules`
List all scheduled workflows.

**Output:**
- Schedule ID
- Workflow ID
- Cron expression or event trigger
- Next run time (for cron)
- Last run time
- Enabled status

#### `workbench workflow unschedule <schedule-id>`
Remove a scheduled workflow.

**Example:**
```bash
workbench workflow unschedule abc123-def456-789
```

## 🎯 Acceptance Criteria Status

✅ **ScheduleConfig Type**: Added to `src/types/workflow.ts`
✅ **WorkflowScheduler Class**: Implemented in `src/workflows/scheduler.ts`
✅ **Cron Support**: Parses and executes cron expressions
✅ **Event Triggers**: Subscribes to EventBus events
✅ **Standalone Module**: Not implemented in Dashboard
✅ **CLI Commands**: `schedule`, `schedules`, `unschedule`
✅ **JSON Persistence**: Schedules stored in `~/.workbench/schedules/schedules.json`
✅ **19 Tests**: All passing (exceeds minimum of 10)
✅ **TypeScript Compilation**: `npx tsc --noEmit` succeeds
✅ **Test Suite**: Scheduler tests pass

## 🏗️ Architecture

### Separation of Concerns
- **Dashboard**: HTTP/WebSocket server (imports and starts scheduler)
- **Scheduler**: Background job runtime (standalone module)

### Integration Points
```typescript
import { WorkflowScheduler } from '../workflows/scheduler.js';

const scheduler = new WorkflowScheduler(
  registry,
  anthropicClient,
  sessionStorage,
  toolRegistry,
  eventBus
);

await scheduler.start();  // Dashboard starts scheduler
scheduler.stop();         // Dashboard stops scheduler
```

### Storage
- **Path**: `~/.workbench/schedules/schedules.json`
- **Format**: JSON array of ScheduleConfig objects
- **Atomic writes**: Uses temp file + rename pattern

## 🔄 Workflow Execution Flow

### Cron-Based
1. Schedule created with cron expression
2. Scheduler calculates next run time
3. Sets timeout until next run
4. Executes workflow at scheduled time
5. Reschedules for next interval

### Event-Based
1. Schedule created with event name
2. Scheduler subscribes to event on EventBus
3. Workflow executes when event is emitted
4. Updates lastRunAt timestamp

## 📝 Notes

- **Cron Parser**: Simplified implementation for MVP (supports basic patterns)
- **Event Types**: Type-safe event subscription via TypedEventBus
- **Error Handling**: Failed executions are logged but don't crash scheduler
- **Restart Resilience**: Schedules reload from disk on scheduler start

## 🚀 Next Steps

1. **Dashboard Integration**: Import and start scheduler in dashboard server
2. **Web UI**: Add schedule management to React dashboard
3. **Advanced Cron**: Add full cron-parser library for complex expressions
4. **Monitoring**: Add metrics for schedule execution success/failure rates
