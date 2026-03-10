// src/memory/index.ts — Memory System Barrel Export

export { validateMemoryEntry, validateQuery } from './validation.js';
export { SessionSummarizer, summarizeSession } from './session-summarizer.js';
export { SUMMARY_PROMPT, createSessionPrompt } from './summary-prompt.js';
export type { LLMCallback, SummarizerConfig } from './session-summarizer.js';
export { LanceDBMemoryStore } from './lancedb-store.js';
export { EmbeddingProvider } from './embeddings.js';
export { createAutoMemoryHook } from './auto-memory.js';
export type { AutoMemoryConfig } from './auto-memory.js';
export { cleanupOldMemories, getDefaultRetentionDays } from './memory-cleanup.js';
export type { CleanupResult, CleanupOptions } from './memory-cleanup.js';
export type {
  MemoryType,
  MemorySource,
  MemoryEntry,
  MemoryQuery,
  MemoryResult,
  EmbeddingConfig,
} from '../types/memory.js';
