// src/config/__tests__/model-resolver.test.ts — Model Resolver Tests

import { describe, it, expect } from 'vitest';
import { resolveModelName } from '../model-resolver.js';

describe('resolveModelName', () => {
  describe('Alias Resolution', () => {
    it('should resolve "opus-4" to full model identifier', () => {
      expect(resolveModelName('opus-4')).toBe('claude-opus-4-20250514');
    });

    it('should resolve "sonnet-4" to full model identifier', () => {
      expect(resolveModelName('sonnet-4')).toBe('claude-sonnet-4-20250514');
    });

    it('should resolve "sonnet-3.5" to full model identifier', () => {
      expect(resolveModelName('sonnet-3.5')).toBe('claude-3-5-sonnet-20241022');
    });

    it('should resolve "haiku-4" to full model identifier', () => {
      expect(resolveModelName('haiku-4')).toBe('claude-3-5-haiku-20241022');
    });
  });

  describe('Case Insensitivity', () => {
    it('should resolve uppercase aliases', () => {
      expect(resolveModelName('OPUS-4')).toBe('claude-opus-4-20250514');
      expect(resolveModelName('SONNET-4')).toBe('claude-sonnet-4-20250514');
    });

    it('should resolve mixed-case aliases', () => {
      expect(resolveModelName('Opus-4')).toBe('claude-opus-4-20250514');
      expect(resolveModelName('SoNnEt-4')).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('Whitespace Handling', () => {
    it('should trim leading whitespace', () => {
      expect(resolveModelName('  opus-4')).toBe('claude-opus-4-20250514');
    });

    it('should trim trailing whitespace', () => {
      expect(resolveModelName('sonnet-4  ')).toBe('claude-sonnet-4-20250514');
    });

    it('should trim both leading and trailing whitespace', () => {
      expect(resolveModelName('  sonnet-3.5  ')).toBe('claude-3-5-sonnet-20241022');
    });

    it('should handle tabs and newlines', () => {
      expect(resolveModelName('\t\nopus-4\n\t')).toBe('claude-opus-4-20250514');
    });
  });

  describe('Unknown Aliases', () => {
    it('should return normalized original for unknown alias', () => {
      expect(resolveModelName('unknown-model')).toBe('unknown-model');
    });

    it('should normalize unknown aliases to lowercase', () => {
      expect(resolveModelName('UNKNOWN-MODEL')).toBe('unknown-model');
    });

    it('should trim and normalize unknown aliases', () => {
      expect(resolveModelName('  UNKNOWN-MODEL  ')).toBe('unknown-model');
    });
  });

  describe('Full Model Names (Passthrough)', () => {
    it('should pass through full model identifier unchanged (except normalization)', () => {
      const fullName = 'claude-opus-4-20250514';
      expect(resolveModelName(fullName)).toBe(fullName);
    });

    it('should normalize full model identifier case', () => {
      expect(resolveModelName('CLAUDE-OPUS-4-20250514')).toBe('claude-opus-4-20250514');
    });

    it('should trim whitespace from full model identifier', () => {
      expect(resolveModelName('  claude-sonnet-4-20250514  ')).toBe('claude-sonnet-4-20250514');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      expect(resolveModelName('')).toBe('');
    });

    it('should handle whitespace-only string', () => {
      expect(resolveModelName('   ')).toBe('');
    });

    it('should handle single character input', () => {
      expect(resolveModelName('x')).toBe('x');
    });

    it('should handle special characters in model names', () => {
      expect(resolveModelName('model-with-dashes-123')).toBe('model-with-dashes-123');
    });
  });

  describe('Combined Normalization', () => {
    it('should apply trim + lowercase + alias lookup in correct order', () => {
      expect(resolveModelName('  OPUS-4  ')).toBe('claude-opus-4-20250514');
    });

    it('should not match alias if internal whitespace differs', () => {
      // Note: Our aliases don't have internal whitespace, so this tests fallback
      expect(resolveModelName('opus 4')).toBe('opus 4');
    });
  });
});
