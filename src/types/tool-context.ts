// src/types/tool-context.ts — Cross-cutting Tool Context

import type { TypedEventBus } from '../events/event-bus.js';

/**
 * ToolContext consolidates cross-cutting concerns passed to tool execution.
 * Tools remain pure functions; the agent loop manages these concerns.
 */
export interface ToolContext {
  /**
   * AbortSignal for cancelling long-running operations.
   * Tools should check signal.aborted and listen to 'abort' events.
   */
  signal?: AbortSignal;

  /**
   * Permission context for authorization checks.
   * Reserved for future use.
   */
  permissions?: Record<string, unknown>;

  /**
   * Event bus for emitting tool-specific events.
   * Optional - tools can emit progress, warnings, etc.
   */
  eventBus?: TypedEventBus;

  /**
   * Additional metadata for the tool execution context.
   * Can include runId, sessionId, step index, etc.
   */
  metadata?: Record<string, unknown>;
}
