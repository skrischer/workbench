// src/llm/fallback-handler.ts — Model Fallback Handler with Cooldown Management

import { FALLBACK_CHAIN, MODEL_COOLDOWN_MS } from '../config/models.js';
import { classifyError } from './error-classifier.js';
import { eventBus } from '../events/event-bus.js';
import type { ModelFallbackTriggeredEvent, ModelCooldownEvent } from '../events/model-events.js';

/**
 * Cooldown entry for a model
 */
interface CooldownEntry {
  /** When cooldown expires (milliseconds since epoch) */
  expiresAt: number;
  /** Reason for cooldown */
  reason: string;
}

/**
 * FallbackHandler — Manages model fallback logic with cooldown tracking
 * 
 * Tracks failed models and their cooldown periods, selects next available
 * model from the fallback chain, and emits events for observability.
 */
export class FallbackHandler {
  /** Map of model name to cooldown entry */
  private cooldowns: Map<string, CooldownEntry> = new Map();
  
  /**
   * Get the next available model from the fallback chain
   * 
   * @param currentModel - Current model that failed (optional)
   * @returns Next model to try, or null if all models exhausted
   */
  getNextModel(currentModel?: string): string | null {
    // Find current model index in chain
    let startIndex = 0;
    if (currentModel) {
      const currentIndex = FALLBACK_CHAIN.indexOf(currentModel as any);
      if (currentIndex !== -1) {
        startIndex = currentIndex + 1;
      }
    }
    
    // Try each model in order, skipping those in cooldown
    for (let i = startIndex; i < FALLBACK_CHAIN.length; i++) {
      const candidate = FALLBACK_CHAIN[i];
      if (!this.isInCooldown(candidate)) {
        return candidate;
      }
    }
    
    // All models exhausted or in cooldown
    return null;
  }
  
  /**
   * Check if a model is currently in cooldown
   * 
   * @param model - Model identifier
   * @returns True if model is in cooldown, false otherwise
   */
  isInCooldown(model: string): boolean {
    const entry = this.cooldowns.get(model);
    if (!entry) return false;
    
    const now = Date.now();
    if (now >= entry.expiresAt) {
      // Cooldown expired, remove entry
      this.cooldowns.delete(model);
      return false;
    }
    
    return true;
  }
  
  /**
   * Put a model into cooldown
   * 
   * @param model - Model identifier
   * @param reason - Reason for cooldown
   * @param durationMs - Cooldown duration (defaults to MODEL_COOLDOWN_MS)
   */
  setCooldown(model: string, reason: string, durationMs: number = MODEL_COOLDOWN_MS): void {
    const now = Date.now();
    const expiresAt = now + durationMs;
    
    this.cooldowns.set(model, { expiresAt, reason });
    
    // Emit cooldown event
    const event: ModelCooldownEvent = {
      model,
      durationMs,
      expiresAt: new Date(expiresAt).toISOString(),
      reason
    };
    
    eventBus.emit('model:cooldown:start', event);
  }
  
  /**
   * Clear cooldown for a specific model or all models
   * 
   * @param model - Optional model identifier (clears all if not provided)
   */
  clearCooldown(model?: string): void {
    if (model) {
      this.cooldowns.delete(model);
    } else {
      this.cooldowns.clear();
    }
  }
  
  /**
   * Get all models currently in cooldown
   * 
   * @returns Array of model identifiers in cooldown
   */
  getCooldownModels(): string[] {
    const now = Date.now();
    const result: string[] = [];
    
    for (const [model, entry] of this.cooldowns.entries()) {
      if (now < entry.expiresAt) {
        result.push(model);
      }
    }
    
    return result;
  }
  
  /**
   * Handle an error and determine if fallback should be attempted
   * 
   * @param error - Error that occurred
   * @param currentModel - Model that generated the error
   * @returns Object with shouldFallback flag and optional nextModel
   */
  handleError(error: unknown, currentModel: string): { 
    shouldFallback: boolean; 
    nextModel: string | null;
    classification: ReturnType<typeof classifyError>;
  } {
    const classification = classifyError(error);
    
    if (!classification.shouldFallback) {
      return { 
        shouldFallback: false, 
        nextModel: null,
        classification 
      };
    }
    
    // Put current model into cooldown
    this.setCooldown(currentModel, classification.reason);
    
    // Try to get next model
    const nextModel = this.getNextModel(currentModel);
    
    if (nextModel) {
      // Emit fallback triggered event
      const event: ModelFallbackTriggeredEvent = {
        from: currentModel,
        to: nextModel,
        reason: classification.reason,
        statusCode: classification.statusCode,
        timestamp: new Date().toISOString()
      };
      
      eventBus.emit('model:fallback:triggered', event);
    } else {
      // All models exhausted
      eventBus.emit('model:fallback:exhausted', {
        attemptedModels: [currentModel],
        finalError: classification.message,
        timestamp: new Date().toISOString()
      });
    }
    
    return { 
      shouldFallback: true, 
      nextModel,
      classification 
    };
  }
}

/** Singleton instance */
export const fallbackHandler = new FallbackHandler();
