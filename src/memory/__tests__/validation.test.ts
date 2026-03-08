// src/memory/__tests__/validation.test.ts — Memory Validation Tests

import { describe, it, expect } from 'vitest';
import { validateMemoryEntry, validateQuery } from '../validation.js';
import type { MemoryEntry, MemoryQuery } from '../../types/memory.js';

describe('validateMemoryEntry', () => {
  const validEntry: MemoryEntry = {
    id: 'mem-123',
    type: 'session',
    content: 'User prefers dark mode',
    summary: 'Dark mode preference',
    tags: ['preference', 'ui'],
    source: {
      type: 'session',
      sessionId: 'sess-456',
      runId: 'run-789',
    },
    createdAt: '2026-03-07T17:30:00Z',
    updatedAt: '2026-03-07T17:30:00Z',
    metadata: { confidence: 0.95 },
  };

  it('should accept a valid memory entry', () => {
    expect(() => validateMemoryEntry(validEntry)).not.toThrow();
  });

  it('should reject entry with empty content', () => {
    const invalidEntry = { ...validEntry, content: '' };
    expect(() => validateMemoryEntry(invalidEntry)).toThrow('content cannot be empty');
  });

  it('should reject entry with missing content', () => {
    const invalidEntry = { ...validEntry, content: undefined as unknown as string };
    expect(() => validateMemoryEntry(invalidEntry)).toThrow('content cannot be empty');
  });

  it('should reject entry with invalid memory type', () => {
    const invalidEntry = { ...validEntry, type: 'invalid' as any };
    expect(() => validateMemoryEntry(invalidEntry)).toThrow('Invalid memory type');
  });

  it('should reject entry with non-array tags', () => {
    const invalidEntry = { ...validEntry, tags: 'not-an-array' as any };
    expect(() => validateMemoryEntry(invalidEntry)).toThrow('tags must be an array');
  });

  it('should reject entry with non-string tags', () => {
    const invalidEntry = { ...validEntry, tags: ['valid', 123, 'tag'] as any };
    expect(() => validateMemoryEntry(invalidEntry)).toThrow('All tags must be strings');
  });

  it('should reject entry with missing source', () => {
    const invalidEntry = { ...validEntry, source: undefined as any };
    expect(() => validateMemoryEntry(invalidEntry)).toThrow('must have a valid source');
  });

  it('should reject entry with invalid source type', () => {
    const invalidEntry = {
      ...validEntry,
      source: { type: 'invalid' as any },
    };
    expect(() => validateMemoryEntry(invalidEntry)).toThrow('Invalid source type');
  });

  it('should accept entry without optional fields', () => {
    const minimalEntry: MemoryEntry = {
      id: 'mem-minimal',
      type: 'knowledge',
      content: 'TypeScript is a superset of JavaScript',
      tags: [],
      source: { type: 'user' },
      createdAt: '2026-03-07T17:30:00Z',
      updatedAt: '2026-03-07T17:30:00Z',
    };
    expect(() => validateMemoryEntry(minimalEntry)).not.toThrow();
  });
});

describe('validateQuery', () => {
  const validQuery: MemoryQuery = {
    text: 'dark mode preferences',
    type: 'preference',
    tags: ['ui'],
    limit: 5,
    minScore: 0.7,
  };

  it('should accept a valid query', () => {
    expect(() => validateQuery(validQuery)).not.toThrow();
  });

  it('should reject query with empty text', () => {
    const invalidQuery = { ...validQuery, text: '' };
    expect(() => validateQuery(invalidQuery)).toThrow('text cannot be empty');
  });

  it('should reject query with missing text', () => {
    const invalidQuery = { ...validQuery, text: undefined as unknown as string };
    expect(() => validateQuery(invalidQuery)).toThrow('text cannot be empty');
  });

  it('should reject query with invalid type', () => {
    const invalidQuery = { ...validQuery, type: 'invalid' as any };
    expect(() => validateQuery(invalidQuery)).toThrow('Invalid memory type');
  });

  it('should reject query with non-array tags', () => {
    const invalidQuery = { ...validQuery, tags: 'not-an-array' as any };
    expect(() => validateQuery(invalidQuery)).toThrow('tags must be an array');
  });

  it('should reject query with zero limit', () => {
    const invalidQuery = { ...validQuery, limit: 0 };
    expect(() => validateQuery(invalidQuery)).toThrow('limit must be a positive number');
  });

  it('should reject query with negative limit', () => {
    const invalidQuery = { ...validQuery, limit: -5 };
    expect(() => validateQuery(invalidQuery)).toThrow('limit must be a positive number');
  });

  it('should reject query with minScore below 0', () => {
    const invalidQuery = { ...validQuery, minScore: -0.1 };
    expect(() => validateQuery(invalidQuery)).toThrow('minScore must be between 0 and 1');
  });

  it('should reject query with minScore above 1', () => {
    const invalidQuery = { ...validQuery, minScore: 1.5 };
    expect(() => validateQuery(invalidQuery)).toThrow('minScore must be between 0 and 1');
  });

  it('should accept query with only required text field', () => {
    const minimalQuery: MemoryQuery = { text: 'search term' };
    expect(() => validateQuery(minimalQuery)).not.toThrow();
  });

  it('should accept query with minScore of 0', () => {
    const edgeCaseQuery = { ...validQuery, minScore: 0 };
    expect(() => validateQuery(edgeCaseQuery)).not.toThrow();
  });

  it('should accept query with minScore of 1', () => {
    const edgeCaseQuery = { ...validQuery, minScore: 1 };
    expect(() => validateQuery(edgeCaseQuery)).not.toThrow();
  });
});
