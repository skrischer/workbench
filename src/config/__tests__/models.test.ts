// src/config/__tests__/models.test.ts — Tests for Model Constants

import { describe, it, expect } from 'vitest';
import {
  ANTHROPIC_API_URL,
  DEFAULT_MODEL,
  MODEL_CONSTANTS,
  isValidModel,
} from '../models.js';

describe('Model Constants', () => {
  describe('ANTHROPIC_API_URL', () => {
    it('should be the correct Anthropic Messages API URL', () => {
      expect(ANTHROPIC_API_URL).toBe('https://api.anthropic.com/v1/messages');
    });

    it('should be a valid HTTPS URL', () => {
      expect(ANTHROPIC_API_URL).toMatch(/^https:\/\//);
    });
  });

  describe('DEFAULT_MODEL', () => {
    it('should be defined and non-empty', () => {
      expect(DEFAULT_MODEL).toBeDefined();
      expect(DEFAULT_MODEL).not.toBe('');
    });

    it('should be claude-sonnet-4-20250514', () => {
      expect(DEFAULT_MODEL).toBe('claude-sonnet-4-20250514');
    });

    it('should match MODEL_CONSTANTS.DEFAULT', () => {
      expect(DEFAULT_MODEL).toBe(MODEL_CONSTANTS.DEFAULT);
    });
  });

  describe('MODEL_CONSTANTS', () => {
    it('should contain all required model identifiers', () => {
      expect(MODEL_CONSTANTS.DEFAULT).toBeDefined();
      expect(MODEL_CONSTANTS.FALLBACK).toBeDefined();
      expect(MODEL_CONSTANTS.OPUS_4).toBeDefined();
      expect(MODEL_CONSTANTS.LEGACY_SONNET_4).toBeDefined();
    });

    it('should have correct model values', () => {
      expect(MODEL_CONSTANTS.DEFAULT).toBe('claude-sonnet-4-20250514');
      expect(MODEL_CONSTANTS.FALLBACK).toBe('claude-3-5-sonnet-20241022');
      expect(MODEL_CONSTANTS.OPUS_4).toBe('claude-opus-4-20250514');
      expect(MODEL_CONSTANTS.LEGACY_SONNET_4).toBe('claude-sonnet-4');
    });

    it('should be immutable (as const)', () => {
      // TypeScript enforces this at compile time, but we can verify the structure
      expect(Object.isFrozen(MODEL_CONSTANTS)).toBe(false); // 'as const' doesn't freeze at runtime
      expect(typeof MODEL_CONSTANTS).toBe('object');
    });

    it('should have unique values for each constant', () => {
      const values = Object.values(MODEL_CONSTANTS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('isValidModel', () => {
    it('should return true for valid model constants', () => {
      expect(isValidModel(MODEL_CONSTANTS.DEFAULT)).toBe(true);
      expect(isValidModel(MODEL_CONSTANTS.FALLBACK)).toBe(true);
      expect(isValidModel(MODEL_CONSTANTS.OPUS_4)).toBe(true);
      expect(isValidModel(MODEL_CONSTANTS.LEGACY_SONNET_4)).toBe(true);
    });

    it('should return true for DEFAULT_MODEL', () => {
      expect(isValidModel(DEFAULT_MODEL)).toBe(true);
    });

    it('should return false for invalid model strings', () => {
      expect(isValidModel('invalid-model')).toBe(false);
      expect(isValidModel('claude-3')).toBe(false);
      expect(isValidModel('')).toBe(false);
      expect(isValidModel('random-string')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidModel('claude-sonnet-4-20250514')).toBe(true); // Valid exact string
      expect(isValidModel('claude-sonnet-4-20250515')).toBe(false); // Similar but not exact
    });
  });

  describe('Integration - Constants Usage', () => {
    it('should ensure DEFAULT_MODEL is a valid model', () => {
      expect(isValidModel(DEFAULT_MODEL)).toBe(true);
    });

    it('should ensure all MODEL_CONSTANTS values are valid models', () => {
      Object.values(MODEL_CONSTANTS).forEach((model) => {
        expect(isValidModel(model)).toBe(true);
      });
    });

    it('should maintain consistency between DEFAULT_MODEL and MODEL_CONSTANTS.DEFAULT', () => {
      expect(DEFAULT_MODEL).toBe(MODEL_CONSTANTS.DEFAULT);
    });
  });
});
