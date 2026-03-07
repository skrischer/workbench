// src/types/memory.ts — Memory System Type Definitions

/** Memory type classification */
export type MemoryType = 'session' | 'project' | 'knowledge' | 'preference';

/** Source information for memory entries */
export interface MemorySource {
  type: 'session' | 'user' | 'tool' | 'import';
  sessionId?: string;
  runId?: string;
}

/** Core memory entry structure */
export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  summary?: string;
  tags: string[];
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/** Query parameters for memory search */
export interface MemoryQuery {
  text: string;
  type?: MemoryType;
  tags?: string[];
  limit?: number;
  minScore?: number;
}

/** Search result with relevance score */
export interface MemoryResult {
  entry: MemoryEntry;
  score: number;
}

/** Embedding configuration */
export interface EmbeddingConfig {
  model: string;
  dimensions: number;
  apiUrl?: string;
}
