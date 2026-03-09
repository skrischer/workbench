// src/tools/validator.ts — JSON Schema Validation for Tool Inputs

import AjvModule, { type ErrorObject } from 'ajv';

// Handle ESM/CJS interop
const Ajv = (AjvModule as any).default || AjvModule;

/**
 * Result of a validation operation.
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Singleton Ajv instance for performance (caches compiled validators).
 * Configure to allow additional properties (warn, don't reject).
 */
const ajv = new Ajv({
  allErrors: true, // Collect all errors, not just first
  strictSchema: false, // Allow flexible schemas
});

/**
 * Validate tool input against a JSON Schema.
 * 
 * @param schema - JSON Schema describing expected input structure
 * @param input - Actual input data to validate
 * @returns ValidationResult with valid flag and optional error messages
 * 
 * @example
 * ```typescript
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' }
 *   },
 *   required: ['name']
 * };
 * 
 * const result = validateToolInput(schema, { name: 'Alice', age: 30 });
 * // { valid: true }
 * 
 * const result2 = validateToolInput(schema, { age: 30 });
 * // { valid: false, errors: ["must have required property 'name'"] }
 * ```
 */
export function validateToolInput(
  schema: Record<string, unknown>,
  input: Record<string, unknown>
): ValidationResult {
  // Ajv automatically caches compiled validators by schema
  const validate = ajv.compile(schema);
  const valid = validate(input);

  if (valid) {
    return { valid: true };
  }

  // Extract human-readable error messages
  const errors = (validate.errors || []).map((err: ErrorObject) => {
    const path = err.instancePath || '(root)';
    const message = err.message || 'validation error';
    
    // Include property name for missing required fields
    if (err.keyword === 'required' && err.params && 'missingProperty' in err.params) {
      return `must have required property '${err.params.missingProperty}'`;
    }
    
    return `${path} ${message}`;
  });

  return {
    valid: false,
    errors: errors.length > 0 ? errors : ['validation failed'],
  };
}
