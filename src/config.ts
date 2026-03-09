/**
 * Central configuration for workbench
 */

/**
 * Default Claude model to use when no model is explicitly specified.
 * Can be overridden via WORKBENCH_DEFAULT_MODEL environment variable.
 * 
 * Defaults to 'claude-sonnet-4' (latest Sonnet 4.x).
 * Previous default 'claude-3-5-sonnet-20241022' is deprecated and causes 404 errors.
 */
export const DEFAULT_MODEL = process.env.WORKBENCH_DEFAULT_MODEL ?? 'claude-sonnet-4';
