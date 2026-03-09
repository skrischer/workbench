// src/types/tool-context.ts — Cross-cutting Tool Context

import type { TypedEventBus } from '../events/event-bus.js';
import type { PermissionGuard } from '../tools/permissions.js';

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
   * Permission guard for path-based access control.
   * Tools that access files should check paths against this guard.
   */
  permissions?: PermissionGuard;

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
