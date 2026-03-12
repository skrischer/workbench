// src/llm/error-classifier.ts — Error Classification for Model Fallback

/**
 * HTTP status codes that trigger model fallback
 */
const RETRIABLE_STATUS_CODES = new Set([
  404, // Not Found - model may not exist or be temporarily unavailable
  429, // Too Many Requests - rate limit exceeded
  503, // Service Unavailable - temporary server issue
]);

/**
 * Error classification result
 */
export interface ErrorClassification {
  /** Whether this error should trigger a fallback */
  shouldFallback: boolean;
  /** HTTP status code if available */
  statusCode?: number;
  /** Original error message */
  message: string;
  /** Reason for classification decision */
  reason: string;
}

/**
 * Classify an error to determine if it should trigger model fallback
 * 
 * @param error - Error object or message
 * @returns Classification result with fallback recommendation
 */
export function classifyError(error: unknown): ErrorClassification {
  // Extract error message
  const message = error instanceof Error ? error.message : String(error);
  
  // Check for HTTP status codes in error message
  const statusMatch = message.match(/status[:\s]+(\d{3})/i) || message.match(/\b(\d{3})\b/);
  const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
  
  // If we have a status code, check if it's retriable
  if (statusCode !== undefined) {
    const shouldFallback = RETRIABLE_STATUS_CODES.has(statusCode);
    return {
      shouldFallback,
      statusCode,
      message,
      reason: shouldFallback 
        ? `Status ${statusCode} indicates retriable error`
        : `Status ${statusCode} is not retriable`
    };
  }
  
  // Check for specific error patterns
  if (message.includes('Rate limit')) {
    return {
      shouldFallback: true,
      statusCode: 429,
      message,
      reason: 'Rate limit error detected'
    };
  }
  
  if (message.includes('Service Unavailable') || message.includes('503')) {
    return {
      shouldFallback: true,
      statusCode: 503,
      message,
      reason: 'Service unavailable error detected'
    };
  }
  
  if (message.includes('Not Found') || message.includes('404')) {
    return {
      shouldFallback: true,
      statusCode: 404,
      message,
      reason: 'Not found error detected'
    };
  }
  
  // Network errors are not retriable with a different model
  if (message.includes('Network error') || message.includes('ECONNREFUSED')) {
    return {
      shouldFallback: false,
      message,
      reason: 'Network error - model fallback will not help'
    };
  }
  
  // Authentication errors should not trigger fallback
  if (message.includes('Authentication failed') || message.includes('401')) {
    return {
      shouldFallback: false,
      statusCode: 401,
      message,
      reason: 'Authentication error - model fallback will not help'
    };
  }
  
  // Default: do not fallback for unknown errors
  return {
    shouldFallback: false,
    message,
    reason: 'Unknown error type - not retriable via fallback'
  };
}

/**
 * Check if a status code should trigger model fallback
 * 
 * @param statusCode - HTTP status code
 * @returns True if this status code warrants a fallback attempt
 */
export function isRetriableStatusCode(statusCode: number): boolean {
  return RETRIABLE_STATUS_CODES.has(statusCode);
}
