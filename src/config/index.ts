// src/config/index.ts — Central Configuration Exports

export {
  ANTHROPIC_API_URL,
  DEFAULT_MODEL,
  MODEL_CONSTANTS,
  MODEL_ALIASES,
  isValidModel,
  FALLBACK_CHAIN,
  MODEL_COOLDOWN_MS,
} from './models.js';

export { resolveModelName } from './model-resolver.js';

export {
  loadUserConfig,
  saveUserConfig,
  DEFAULT_USER_CONFIG,
} from './user-config.js';
export type { UserConfig } from './user-config.js';
