// src/llm/__tests__/fallback-handler.test.ts — FallbackHandler Integration Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FallbackHandler } from '../fallback-handler.js';
import { FALLBACK_CHAIN, MODEL_COOLDOWN_MS } from '../../config/models.js';
import { eventBus } from '../../events/event-bus.js';

describe('FallbackHandler', () => {
  let handler: FallbackHandler;

  beforeEach(() => {
    handler = new FallbackHandler();
    handler.clearCooldown(); // Reset cooldowns between tests
    eventBus.clear(); // Clear all event listeners
  });

  describe('getNextModel', () => {
    it('should return first model when no current model specified', () => {
      const next = handler.getNextModel();
      expect(next).toBe(FALLBACK_CHAIN[0]);
    });

    it('should return next model in chain after current model', () => {
      const next = handler.getNextModel(FALLBACK_CHAIN[0]);
      expect(next).toBe(FALLBACK_CHAIN[1]);
    });

    it('should return null when all models exhausted', () => {
      const lastModel = FALLBACK_CHAIN[FALLBACK_CHAIN.length - 1];
      const next = handler.getNextModel(lastModel);
      expect(next).toBeNull();
    });

    it('should skip models in cooldown', () => {
      const firstModel = FALLBACK_CHAIN[0];
      const secondModel = FALLBACK_CHAIN[1];
      const thirdModel = FALLBACK_CHAIN[2];

      // Put second model in cooldown
      handler.setCooldown(secondModel, 'Test failure');

      // Should skip second and return third
      const next = handler.getNextModel(firstModel);
      expect(next).toBe(thirdModel);
    });

    it('should return null when all remaining models in cooldown', () => {
      // Put all models except first in cooldown
      for (let i = 1; i < FALLBACK_CHAIN.length; i++) {
        handler.setCooldown(FALLBACK_CHAIN[i], 'Test failure');
      }

      const next = handler.getNextModel(FALLBACK_CHAIN[0]);
      expect(next).toBeNull();
    });
  });

  describe('isInCooldown', () => {
    it('should return false for model not in cooldown', () => {
      expect(handler.isInCooldown(FALLBACK_CHAIN[0])).toBe(false);
    });

    it('should return true for model in cooldown', () => {
      const model = FALLBACK_CHAIN[0];
      handler.setCooldown(model, 'Test failure');
      expect(handler.isInCooldown(model)).toBe(true);
    });

    it('should return false after cooldown expires', () => {
      const model = FALLBACK_CHAIN[0];
      const shortCooldown = 50; // 50ms

      handler.setCooldown(model, 'Test failure', shortCooldown);
      expect(handler.isInCooldown(model)).toBe(true);

      // Wait for cooldown to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(handler.isInCooldown(model)).toBe(false);
          resolve();
        }, shortCooldown + 10);
      });
    });
  });

  describe('setCooldown', () => {
    it('should put model in cooldown', () => {
      const model = FALLBACK_CHAIN[0];
      handler.setCooldown(model, 'Test failure');
      expect(handler.isInCooldown(model)).toBe(true);
    });

    it('should emit cooldown event', () => {
      const listener = vi.fn();
      eventBus.on('model:cooldown:start', listener);

      const model = FALLBACK_CHAIN[0];
      const reason = 'Test failure';
      handler.setCooldown(model, reason);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          model,
          reason,
          durationMs: MODEL_COOLDOWN_MS
        })
      );
    });

    it('should use custom cooldown duration', () => {
      const model = FALLBACK_CHAIN[0];
      const customDuration = 1000;

      handler.setCooldown(model, 'Test', customDuration);

      const listener = vi.fn();
      eventBus.on('model:cooldown:start', listener);

      handler.setCooldown(model, 'Test 2', customDuration);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          durationMs: customDuration
        })
      );
    });
  });

  describe('clearCooldown', () => {
    it('should clear cooldown for specific model', () => {
      const model = FALLBACK_CHAIN[0];
      handler.setCooldown(model, 'Test failure');
      expect(handler.isInCooldown(model)).toBe(true);

      handler.clearCooldown(model);
      expect(handler.isInCooldown(model)).toBe(false);
    });

    it('should clear all cooldowns when no model specified', () => {
      // Put multiple models in cooldown
      handler.setCooldown(FALLBACK_CHAIN[0], 'Test 1');
      handler.setCooldown(FALLBACK_CHAIN[1], 'Test 2');

      expect(handler.getCooldownModels()).toHaveLength(2);

      handler.clearCooldown();
      expect(handler.getCooldownModels()).toHaveLength(0);
    });
  });

  describe('getCooldownModels', () => {
    it('should return empty array when no models in cooldown', () => {
      expect(handler.getCooldownModels()).toEqual([]);
    });

    it('should return all models in cooldown', () => {
      handler.setCooldown(FALLBACK_CHAIN[0], 'Test 1');
      handler.setCooldown(FALLBACK_CHAIN[1], 'Test 2');

      const cooldownModels = handler.getCooldownModels();
      expect(cooldownModels).toContain(FALLBACK_CHAIN[0]);
      expect(cooldownModels).toContain(FALLBACK_CHAIN[1]);
      expect(cooldownModels).toHaveLength(2);
    });

    it('should not include expired cooldowns', () => {
      const shortCooldown = 50;
      handler.setCooldown(FALLBACK_CHAIN[0], 'Test', shortCooldown);

      expect(handler.getCooldownModels()).toHaveLength(1);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(handler.getCooldownModels()).toHaveLength(0);
          resolve();
        }, shortCooldown + 10);
      });
    });
  });

  describe('handleError', () => {
    it('should trigger fallback on 404 error', () => {
      const listener = vi.fn();
      eventBus.on('model:fallback:triggered', listener);

      const error = new Error('Model not found: status 404');
      const currentModel = FALLBACK_CHAIN[0];

      const result = handler.handleError(error, currentModel);

      expect(result.shouldFallback).toBe(true);
      expect(result.nextModel).toBe(FALLBACK_CHAIN[1]);
      expect(result.classification.statusCode).toBe(404);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should trigger fallback on 429 error', () => {
      const listener = vi.fn();
      eventBus.on('model:fallback:triggered', listener);

      const error = new Error('Rate limit exceeded: status 429');
      const currentModel = FALLBACK_CHAIN[0];

      const result = handler.handleError(error, currentModel);

      expect(result.shouldFallback).toBe(true);
      expect(result.nextModel).toBe(FALLBACK_CHAIN[1]);
      expect(result.classification.statusCode).toBe(429);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should trigger fallback on 503 error', () => {
      const listener = vi.fn();
      eventBus.on('model:fallback:triggered', listener);

      const error = new Error('Service unavailable: 503');
      const currentModel = FALLBACK_CHAIN[0];

      const result = handler.handleError(error, currentModel);

      expect(result.shouldFallback).toBe(true);
      expect(result.nextModel).toBe(FALLBACK_CHAIN[1]);
      expect(result.classification.statusCode).toBe(503);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should not trigger fallback on 401 error', () => {
      const error = new Error('Authentication failed: status 401');
      const currentModel = FALLBACK_CHAIN[0];

      const result = handler.handleError(error, currentModel);

      expect(result.shouldFallback).toBe(false);
      expect(result.nextModel).toBeNull();
      expect(result.classification.statusCode).toBe(401);
    });

    it('should not trigger fallback on network error', () => {
      const error = new Error('Network error: ECONNREFUSED');
      const currentModel = FALLBACK_CHAIN[0];

      const result = handler.handleError(error, currentModel);

      expect(result.shouldFallback).toBe(false);
      expect(result.nextModel).toBeNull();
    });

    it('should not trigger fallback on unknown error', () => {
      const error = new Error('Something went wrong');
      const currentModel = FALLBACK_CHAIN[0];

      const result = handler.handleError(error, currentModel);

      expect(result.shouldFallback).toBe(false);
      expect(result.nextModel).toBeNull();
    });

    it('should put current model in cooldown on fallback', () => {
      const error = new Error('status 404');
      const currentModel = FALLBACK_CHAIN[0];

      handler.handleError(error, currentModel);

      expect(handler.isInCooldown(currentModel)).toBe(true);
    });

    it('should return null when all models exhausted', () => {
      const exhaustedListener = vi.fn();
      eventBus.on('model:fallback:exhausted', exhaustedListener);

      const error = new Error('status 404');
      const lastModel = FALLBACK_CHAIN[FALLBACK_CHAIN.length - 1];

      const result = handler.handleError(error, lastModel);

      expect(result.shouldFallback).toBe(true);
      expect(result.nextModel).toBeNull();
      expect(exhaustedListener).toHaveBeenCalledTimes(1);
    });

    it('should skip cooldown models when finding next model', () => {
      // Put second model in cooldown
      handler.setCooldown(FALLBACK_CHAIN[1], 'Previous failure');

      const error = new Error('status 503');
      const currentModel = FALLBACK_CHAIN[0];

      const result = handler.handleError(error, currentModel);

      // Should skip FALLBACK_CHAIN[1] and return FALLBACK_CHAIN[2]
      expect(result.nextModel).toBe(FALLBACK_CHAIN[2]);
    });

    it('should emit fallback triggered event with correct payload', () => {
      const listener = vi.fn();
      eventBus.on('model:fallback:triggered', listener);

      const error = new Error('Rate limit: status 429');
      const fromModel = FALLBACK_CHAIN[0];
      const toModel = FALLBACK_CHAIN[1];

      handler.handleError(error, fromModel);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          from: fromModel,
          to: toModel,
          reason: expect.stringContaining('429'),
          statusCode: 429,
          timestamp: expect.any(String)
        })
      );
    });

    it('should emit exhausted event when no models left', () => {
      const listener = vi.fn();
      eventBus.on('model:fallback:exhausted', listener);

      const error = new Error('status 404');
      const lastModel = FALLBACK_CHAIN[FALLBACK_CHAIN.length - 1];

      handler.handleError(error, lastModel);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptedModels: [lastModel],
          finalError: expect.any(String),
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('cooldown respects duration', () => {
    it('should respect cooldown for full duration', () => {
      const model = FALLBACK_CHAIN[0];
      const cooldownMs = 100;

      handler.setCooldown(model, 'Test', cooldownMs);

      // Should be in cooldown immediately
      expect(handler.isInCooldown(model)).toBe(true);

      // Should still be in cooldown after half duration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(handler.isInCooldown(model)).toBe(true);

          // Should be out of cooldown after full duration + buffer
          setTimeout(() => {
            expect(handler.isInCooldown(model)).toBe(false);
            resolve();
          }, cooldownMs / 2 + 20);
        }, cooldownMs / 2);
      });
    });
  });

  describe('integration: success after fallback', () => {
    it('should return valid next model after successful error handling', () => {
      const error = new Error('Model not available: status 503');
      const result1 = handler.handleError(error, FALLBACK_CHAIN[0]);

      expect(result1.shouldFallback).toBe(true);
      expect(result1.nextModel).toBe(FALLBACK_CHAIN[1]);

      // If second model also fails
      const result2 = handler.handleError(error, FALLBACK_CHAIN[1]);

      expect(result2.shouldFallback).toBe(true);
      expect(result2.nextModel).toBe(FALLBACK_CHAIN[2]);
    });
  });
});
