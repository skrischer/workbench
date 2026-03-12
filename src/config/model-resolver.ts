// src/config/model-resolver.ts — Model Name Alias Resolution

import { MODEL_ALIASES } from './models.js';

/**
 * Resolve a model name alias to the full model identifier
 * 
 * Normalization pipeline:
 * 1. Trim whitespace
 * 2. Convert to lowercase
 * 3. Look up in alias map
 * 4. Fall back to normalized original if not found
 * 
 * @param modelName - Model name or alias (e.g., "Opus-4", " sonnet-4 ", "claude-sonnet-4-20250514")
 * @returns Resolved full model identifier
 * 
 * @example
 * resolveModelName("Opus-4") → "claude-opus-4-20250514"
 * resolveModelName(" SONNET-4 ") → "claude-sonnet-4-20250514"
 * resolveModelName("claude-opus-4-20250514") → "claude-opus-4-20250514"
 * resolveModelName("") → ""
 */
export function resolveModelName(modelName: string): string {
  // Normalize: trim whitespace and convert to lowercase
  const normalized = modelName.trim().toLowerCase();
  
  // Look up alias, fall back to normalized original
  return MODEL_ALIASES.get(normalized) ?? normalized;
}
