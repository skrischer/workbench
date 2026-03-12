// src/tools/__tests__/validator.test.ts — Tests for JSON Schema Validator

import { describe, it, expect } from 'vitest';
import { validateToolInput } from '../validator.js';

describe('validateToolInput', () => {
  it('should return valid:true for input matching schema', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    };

    const input = { name: 'Alice', age: 30 };
    const result = validateToolInput(schema, input);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should return valid:false when required field is missing', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    };

    const input = { age: 30 };
    const result = validateToolInput(schema, input);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]).toContain("must have required property 'name'");
  });

  it('should return valid:false when field has wrong type (string instead of number)', () => {
    const schema = {
      type: 'object',
      properties: {
        age: { type: 'number' },
      },
    };

    const input = { age: 'thirty' };
    const result = validateToolInput(schema, input);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]).toContain('must be number');
  });

  it('should allow extra properties (additionalProperties not set to false)', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    };

    const input = { name: 'Alice', extraField: 'extra value' };
    const result = validateToolInput(schema, input);

    // Should pass — extra properties are allowed by default
    expect(result.valid).toBe(true);
  });

  it('should return valid:true for empty input when no required fields', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    };

    const input = {};
    const result = validateToolInput(schema, input);

    expect(result.valid).toBe(true);
  });

  it('should validate nested objects correctly', () => {
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['name'],
        },
      },
      required: ['user'],
    };

    const validInput = {
      user: {
        name: 'Bob',
        email: 'bob@example.com',
      },
    };

    const result = validateToolInput(schema, validInput);
    expect(result.valid).toBe(true);

    const invalidInput = {
      user: {
        email: 'bob@example.com',
      },
    };

    const result2 = validateToolInput(schema, invalidInput);
    expect(result2.valid).toBe(false);
    expect(result2.errors?.[0]).toContain('name');
  });

  it('should collect multiple errors when allErrors is true', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        email: { type: 'string' },
      },
      required: ['name', 'age'],
    };

    const input = { email: 'test@example.com' };
    const result = validateToolInput(schema, input);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    // Should have 2 errors: missing 'name' and missing 'age'
    expect(result.errors!.length).toBeGreaterThanOrEqual(2);
  });

  it('should validate boolean type correctly', () => {
    const schema = {
      type: 'object',
      properties: {
        active: { type: 'boolean' },
      },
      required: ['active'],
    };

    const validInput = { active: true };
    const result = validateToolInput(schema, validInput);
    expect(result.valid).toBe(true);

    const invalidInput = { active: 'yes' };
    const result2 = validateToolInput(schema, invalidInput);
    expect(result2.valid).toBe(false);
    expect(result2.errors?.[0]).toContain('must be boolean');
  });

  it('should validate number type correctly', () => {
    const schema = {
      type: 'object',
      properties: {
        count: { type: 'number' },
      },
      required: ['count'],
    };

    const validInput = { count: 42 };
    const result = validateToolInput(schema, validInput);
    expect(result.valid).toBe(true);

    const validInput2 = { count: 3.14 };
    const result2 = validateToolInput(schema, validInput2);
    expect(result2.valid).toBe(true);

    const invalidInput = { count: '42' };
    const result3 = validateToolInput(schema, invalidInput);
    expect(result3.valid).toBe(false);
  });

  it('should handle optional fields correctly', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        nickname: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'],
    };

    // Only required field provided
    const input1 = { name: 'Alice' };
    const result1 = validateToolInput(schema, input1);
    expect(result1.valid).toBe(true);

    // Required + one optional
    const input2 = { name: 'Alice', nickname: 'Ally' };
    const result2 = validateToolInput(schema, input2);
    expect(result2.valid).toBe(true);

    // All fields
    const input3 = { name: 'Alice', nickname: 'Ally', age: 30 };
    const result3 = validateToolInput(schema, input3);
    expect(result3.valid).toBe(true);
  });

  it('should cache compiled validators for performance', () => {
    const schema = {
      type: 'object',
      properties: {
        test: { type: 'string' },
      },
    };

    // Call multiple times with the same schema
    // Should reuse cached validator (no way to test directly, but validates behavior)
    const input1 = { test: 'first' };
    const result1 = validateToolInput(schema, input1);
    expect(result1.valid).toBe(true);

    const input2 = { test: 'second' };
    const result2 = validateToolInput(schema, input2);
    expect(result2.valid).toBe(true);

    const input3 = { test: 123 };
    const result3 = validateToolInput(schema, input3);
    expect(result3.valid).toBe(false);
  });

  it('should handle complex real-world schema from tool interface', () => {
    // Example schema similar to what tools actually use
    const schema = {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'File path to read',
        },
        encoding: {
          type: 'string',
          description: 'File encoding',
          default: 'utf8',
        },
        maxLines: {
          type: 'number',
          description: 'Maximum number of lines to read',
        },
      },
      required: ['path'],
    };

    const validInput = {
      path: '/tmp/test.txt',
      encoding: 'utf8',
      maxLines: 100,
    };

    const result = validateToolInput(schema, validInput);
    expect(result.valid).toBe(true);

    const minimalInput = { path: '/tmp/test.txt' };
    const result2 = validateToolInput(schema, minimalInput);
    expect(result2.valid).toBe(true);

    const invalidInput = { encoding: 'utf8' };
    const result3 = validateToolInput(schema, invalidInput);
    expect(result3.valid).toBe(false);
    expect(result3.errors?.[0]).toContain('path');
  });
});
