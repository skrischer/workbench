// src/tui/types.ts — TUI-specific type definitions

import type { SessionStatus } from '../types/index.js';

/** Compact session preview for the session list */
export interface SessionPreview {
  id: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  promptPreview: string;
}

/** Chat message for display */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  isStreaming?: boolean;
  timestamp: string;
}

/** TUI application state */
export interface TUIState {
  activeSessionId: string | null;
  showSessionPanel: boolean;
  isRunning: boolean;
  runId: string | null;
}
