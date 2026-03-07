// src/memory/index.ts — Memory System Barrel Export

export { validateMemoryEntry, validateQuery } from './validation.js';
export { SessionSummarizer } from './session-summarizer.js';
export { SUMMARY_PROMPT, createSessionPrompt } from './summary-prompt.js';
export type { LLMCallback, SummarizerConfig } from './session-summarizer.js';
export type {
  MemoryType,
  MemorySource,
  MemoryEntry,
  MemoryQuery,
  MemoryResult,
  EmbeddingConfig,
} from '../types/memory.js';
