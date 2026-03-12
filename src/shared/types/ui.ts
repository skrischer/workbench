// src/shared/types/ui.ts — Shared UI Type Definitions

import type { SessionStatus } from '../../types/index.js';

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

/** Tool call display state */
export interface ToolCallState {
  toolId: string;
  toolName: string;
  input: string;
  result?: string;
  status: 'running' | 'success' | 'error';
  durationMs?: number;
}
