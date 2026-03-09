// src/types/__tests__/errors.test.ts — Tests for custom error classes

import { describe, it, expect } from 'vitest';
import { StorageError, NotFoundError } from '../errors.js';

describe('StorageError', () => {
  it('should create a StorageError with correct name and message', () => {
    const error = new StorageError('Something went wrong');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StorageError);
    expect(error.name).toBe('StorageError');
    expect(error.message).toBe('Something went wrong');
  });

  it('should have a stack trace', () => {
    const error = new StorageError('Test error');
    
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('StorageError');
  });
});

describe('NotFoundError', () => {
  it('should create a NotFoundError with correct properties', () => {
    const error = new NotFoundError('Session', 'abc-123');
    
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StorageError);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.name).toBe('NotFoundError');
    expect(error.resource).toBe('Session');
    expect(error.id).toBe('abc-123');
  });

  it('should format error message correctly', () => {
    const sessionError = new NotFoundError('Session', 'session-123');
    expect(sessionError.message).toBe('Session not found: session-123');
    
    const runError = new NotFoundError('Run', 'run-456');
    expect(runError.message).toBe('Run not found: run-456');
    
    const planError = new NotFoundError('Plan', 'plan-789');
    expect(planError.message).toBe('Plan not found: plan-789');
  });

  it('should be identifiable via instanceof check', () => {
    const error = new NotFoundError('Plan', 'test-id');
    
    // Type guards should work
    expect(error instanceof NotFoundError).toBe(true);
    expect(error instanceof StorageError).toBe(true);
    expect(error instanceof Error).toBe(true);
    
    // Regular errors should not match
    const regularError = new Error('Plan not found: test-id');
    expect(regularError instanceof NotFoundError).toBe(false);
  });

  it('should have a stack trace', () => {
    const error = new NotFoundError('Session', 'test-123');
    
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('NotFoundError');
  });

  it('should preserve resource and id properties', () => {
    const error = new NotFoundError('Run', 'run-xyz');
    
    // Properties should be accessible
    const { resource, id } = error;
    expect(resource).toBe('Run');
    expect(id).toBe('run-xyz');
    
    // Properties should be readonly (TypeScript enforces this at compile-time)
    expect(Object.getOwnPropertyDescriptor(error, 'resource')?.writable).toBe(true);
    expect(Object.getOwnPropertyDescriptor(error, 'id')?.writable).toBe(true);
  });
});

describe('Error instanceof checks in catch blocks', () => {
  it('should catch and identify NotFoundError correctly', () => {
    const throwNotFoundError = () => {
      throw new NotFoundError('Session', 'test-session');
    };
    
    expect(() => throwNotFoundError()).toThrow();
    
    try {
      throwNotFoundError();
    } catch (error) {
      expect(error instanceof NotFoundError).toBe(true);
      
      if (error instanceof NotFoundError) {
        expect(error.resource).toBe('Session');
        expect(error.id).toBe('test-session');
      }
    }
  });

  it('should distinguish NotFoundError from generic Error', () => {
    const throwGenericError = () => {
      throw new Error('Session not found: test-session');
    };
    
    try {
      throwGenericError();
    } catch (error) {
      expect(error instanceof NotFoundError).toBe(false);
      expect(error instanceof Error).toBe(true);
    }
  });
});
