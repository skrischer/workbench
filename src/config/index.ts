// src/config/index.ts — Central Configuration Exports

export {
  ANTHROPIC_API_URL,
  DEFAULT_MODEL,
  MODEL_CONSTANTS,
  MODEL_ALIASES,
  isValidModel,
} from './models.js';

export { resolveModelName } from './model-resolver.js';
