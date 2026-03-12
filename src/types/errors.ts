// src/types/errors.ts — Custom Error Classes for Workbench

/**
 * Base error class for storage operations
 */
export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
    
    // Fix prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, StorageError.prototype);
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error thrown when a requested resource is not found in storage
 * 
 * @example
 * throw new NotFoundError('Session', 'abc-123');
 * // Error message: "Session not found: abc-123"
 */
export class NotFoundError extends StorageError {
  /** The type of resource that was not found (e.g., 'Session', 'Run', 'Plan') */
  public readonly resource: string;
  
  /** The identifier of the resource that was not found */
  public readonly id: string;
  
  /** Type guard property for runtime checks */
  public readonly isNotFoundError = true as const;

  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.id = id;
    
    // Fix prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, NotFoundError.prototype);
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Type guard to check if an error is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return (
    error instanceof Error &&
    'isNotFoundError' in error &&
    error.isNotFoundError === true
  );
}

/**
 * Create a NotFoundError compatible error (workaround for class transpilation issues)
 */
export function createNotFoundError(resource: string, id: string): Error {
  const error = new Error(`${resource} not found: ${id}`) as any;
  error.name = 'NotFoundError';
  error.isNotFoundError = true;
  error.resource = resource;
  error.id = id;
  return error;
}
