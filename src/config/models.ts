// src/config/models.ts — Central Model Constants

/**
 * Anthropic API base URL for Messages API
 */
export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Default model used across the codebase
 */
export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * Collection of model identifiers for different use cases
 */
export const MODEL_CONSTANTS = {
  /** Primary default model */
  DEFAULT: DEFAULT_MODEL,
  /** Fallback model for compatibility */
  FALLBACK: 'claude-3-5-sonnet-20241022',
  /** Claude Opus 4 model */
  OPUS_4: 'claude-opus-4-20250514',
  /** Legacy Sonnet 4 identifier (for backward compatibility) */
  LEGACY_SONNET_4: 'claude-sonnet-4',
} as const;

/**
 * Type guard to check if a string is a valid model constant
 */
export function isValidModel(model: string): boolean {
  return Object.values(MODEL_CONSTANTS).includes(model as any);
}
