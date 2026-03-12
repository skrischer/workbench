// src/tui/types.ts — TUI-specific type definitions (re-exports shared + TUI-only)

// Re-export shared types
export type { SessionPreview, ChatMessage, ToolCallState } from '../shared/types/ui.js';

/** TUI application state (TUI-only, not shared) */
export interface TUIState {
  activeSessionId: string | null;
  showSessionPanel: boolean;
  isRunning: boolean;
  runId: string | null;
}
