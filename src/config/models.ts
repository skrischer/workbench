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

/**
 * Model name aliases for user convenience
 * Maps short-form aliases to full model identifiers
 */
export const MODEL_ALIASES = new Map<string, string>([
  ['opus-4', 'claude-opus-4-20250514'],
  ['sonnet-4', 'claude-sonnet-4-20250514'],
  ['sonnet-3.5', 'claude-3-5-sonnet-20241022'],
  ['haiku-4', 'claude-3-5-haiku-20241022'],
]);

/**
 * Model fallback chain configuration
 * Ordered list of model candidates to try in sequence
 */
export const FALLBACK_CHAIN = [
  MODEL_CONSTANTS.DEFAULT,        // claude-sonnet-4-20250514 (primary)
  MODEL_CONSTANTS.FALLBACK,        // claude-3-5-sonnet-20241022 (fallback 1)
  MODEL_CONSTANTS.OPUS_4,          // claude-opus-4-20250514 (fallback 2)
] as const;

/**
 * Cooldown duration in milliseconds after a model failure
 * Models are unavailable for this duration after triggering a fallback
 */
export const MODEL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Model context window sizes (max input tokens)
 */
export const MODEL_CONTEXT_WINDOWS = new Map<string, number>([
  ['claude-opus-4-20250514', 200_000],
  ['claude-sonnet-4-20250514', 200_000],
  ['claude-3-5-sonnet-20241022', 200_000],
  ['claude-3-5-haiku-20241022', 200_000],
]);

/**
 * Get context window size for a model
 * @param model - Model identifier (full or alias)
 * @returns Context window size in tokens, or undefined if unknown
 */
export function getContextWindowSize(model: string): number | undefined {
  // Direct lookup
  const direct = MODEL_CONTEXT_WINDOWS.get(model);
  if (direct !== undefined) return direct;

  // Try alias resolution
  const resolved = MODEL_ALIASES.get(model);
  if (resolved) return MODEL_CONTEXT_WINDOWS.get(resolved);

  // Fuzzy match: check if model string contains a known model prefix
  for (const [key, value] of MODEL_CONTEXT_WINDOWS) {
    if (model.includes(key) || key.includes(model)) return value;
  }

  return undefined;
}
