// src/events/model-events.ts — Model-specific Event Types

/**
 * Event payload when a model fallback is triggered
 */
export interface ModelFallbackTriggeredEvent {
  /** Model that failed */
  from: string;
  /** Model being tried as fallback */
  to: string;
  /** Reason for fallback (error message or code) */
  reason: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Timestamp when fallback was triggered */
  timestamp: string;
}

/**
 * Event payload when all fallback models are exhausted
 */
export interface ModelFallbackExhaustedEvent {
  /** List of models tried in order */
  attemptedModels: string[];
  /** Final error message */
  finalError: string;
  /** Timestamp when exhaustion occurred */
  timestamp: string;
}

/**
 * Event payload when a model enters cooldown
 */
export interface ModelCooldownEvent {
  /** Model that entered cooldown */
  model: string;
  /** Cooldown duration in milliseconds */
  durationMs: number;
  /** When cooldown expires (ISO timestamp) */
  expiresAt: string;
  /** Reason for cooldown */
  reason: string;
}

/**
 * Extended EventMap with model fallback events
 */
export interface ModelEventMap {
  'model:fallback:triggered': ModelFallbackTriggeredEvent;
  'model:fallback:exhausted': ModelFallbackExhaustedEvent;
  'model:cooldown:start': ModelCooldownEvent;
}
