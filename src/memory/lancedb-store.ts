// src/memory/lancedb-store.ts — LanceDB Memory Store Implementation

import { connect, type Connection, type Table } from '@lancedb/lancedb';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MemoryEntry, MemoryQuery, MemoryResult, MemoryType } from '../types/memory.js';
import { validateMemoryEntry, validateQuery } from './validation.js';
import { EmbeddingProvider } from './embeddings.js';

/** LanceDB table schema */
interface LanceDBRecord extends Record<string, unknown> {
  id: string;
  type: string;
  content: string;
  summary?: string;
  tags: string; // JSON stringified array
  source: string; // JSON stringified object
  metadata: string; // JSON stringified object
  createdAt: string;
  updatedAt: string;
  vector: number[]; // LanceDB expects plain array, not Float32Array
}

/**
 * LanceDB-based memory store with vector search capabilities.
 * Stores memory entries with embeddings for semantic search.
 */
export class LanceDBMemoryStore {
  private db: Connection | null = null;
  private table: Table | null = null;
  private embeddingProvider: EmbeddingProvider;
  private dbPath: string;
  private tableName: string;
  private initialized = false;

  /**
   * Creates a LanceDB memory store instance.
   * @param dbPath - Database directory path (default: ~/.workbench/memory/)
   * @param tableName - Table name (default: 'memories')
   * @param embeddingProvider - Optional custom embedding provider
   */
  constructor(
    dbPath?: string,
    tableName = 'memories',
    embeddingProvider?: EmbeddingProvider
  ) {
    this.dbPath = dbPath ?? join(homedir(), '.workbench', 'memory');
    this.tableName = tableName;
    this.embeddingProvider = embeddingProvider ?? new EmbeddingProvider();
  }

  /**
   * Initialize the database connection and table.
   * Creates the database and table if they don't exist.
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return; // Already initialized
    }

    try {
      // Initialize embedding provider
      await this.embeddingProvider.initialize();

      // Connect to LanceDB
      this.db = await connect(this.dbPath);

      // Check if table exists
      const tableNames = await this.db.tableNames();

      if (tableNames.includes(this.tableName)) {
        // Open existing table
        this.table = await this.db.openTable(this.tableName);
      } else {
        // Create new table with initial empty data
        // LanceDB requires at least one record to infer schema
        // All fields must be present, including optional ones, to define schema
        const emptyVector = new Array(this.embeddingProvider.getDimensions()).fill(0);
        const initRecord: LanceDBRecord = {
          id: '__init__',
          type: 'session',
          content: 'Initialization record',
          summary: 'Init',  // Include optional field in schema
          tags: '[]',
          source: JSON.stringify({ type: 'system' }),
          metadata: '{}',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          vector: emptyVector,
        };

        this.table = await this.db.createTable(this.tableName, [initRecord], {
          mode: 'create',
        });

        // Remove the init record
        await this.table.delete('id = "__init__"');
      }

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize LanceDB store: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Add a new memory entry to the store.
   * Generates embedding and stores the entry.
   * @param entry - Memory entry to add (id will be auto-generated if not provided)
   * @returns The added entry with generated id
   */
  async add(entry: Partial<MemoryEntry> & { content: string; type: MemoryType }): Promise<MemoryEntry> {
    await this.ensureInitialized();

    // Build complete entry with defaults
    const now = new Date().toISOString();
    const fullEntry: MemoryEntry = {
      id: entry.id ?? randomUUID(),
      type: entry.type,
      content: entry.content,
      summary: entry.summary,
      tags: entry.tags ?? [],
      source: entry.source ?? { type: 'user' },
      createdAt: entry.createdAt ?? now,
      updatedAt: entry.updatedAt ?? now,
      metadata: entry.metadata,
    };

    // Validate entry
    validateMemoryEntry(fullEntry);

    // Generate embedding
    const vector = await this.embeddingProvider.generateEmbedding(fullEntry.content);

    // Convert to LanceDB record
    const record: LanceDBRecord = {
      id: fullEntry.id,
      type: fullEntry.type,
      content: fullEntry.content,
      summary: fullEntry.summary ?? '', // LanceDB schema requires all fields to be present
      tags: JSON.stringify(fullEntry.tags),
      source: JSON.stringify(fullEntry.source),
      metadata: JSON.stringify(fullEntry.metadata ?? {}),
      createdAt: fullEntry.createdAt,
      updatedAt: fullEntry.updatedAt,
      vector,
    };

    // Insert into table
    await this.table!.add([record]);

    return fullEntry;
  }

  /**
   * Search for memory entries using vector similarity.
   * @param query - Search query with filters
   * @returns Array of memory results sorted by relevance (highest score first)
   */
  async search(query: MemoryQuery): Promise<MemoryResult[]> {
    await this.ensureInitialized();

    // Validate query
    validateQuery(query);

    // Generate query embedding
    const queryVector = await this.embeddingProvider.generateEmbedding(query.text);

    // Build LanceDB query
    let search = this.table!
      .vectorSearch(queryVector)
      .limit(query.limit ?? 10);

    // Apply type filter
    if (query.type) {
      search = search.where(`type = '${query.type}'`);
    }

    // Apply tag filter (check if any query tag is in the record's tags)
    if (query.tags && query.tags.length > 0) {
      // We need to check if the JSON array contains any of the query tags
      // This is a simplified approach - in production you might want a more robust solution
      const tagConditions = query.tags.map((tag) => `tags LIKE '%"${tag}"%'`).join(' OR ');
      search = search.where(`(${tagConditions})`);
    }

    // Execute search
    const results = await search.toArray();

    // Convert to MemoryResult format
    const memoryResults: MemoryResult[] = results
      .map((record: LanceDBRecord & { _distance?: number }): MemoryResult => {
        // LanceDB returns cosine distance, we convert to similarity score (1 - distance)
        // Since vectors are normalized, cosine distance is in [0, 2], we normalize to [0, 1]
        const distance = record._distance ?? 1;
        const score = Math.max(0, 1 - distance / 2);

        return {
          entry: this.recordToEntry(record),
          score,
        };
      })
      .filter((result: MemoryResult) => !query.minScore || result.score >= query.minScore)
      .sort((a: MemoryResult, b: MemoryResult) => b.score - a.score); // Sort by score descending

    return memoryResults;
  }

  /**
   * Get a memory entry by ID.
   * @param id - Entry ID
   * @returns Memory entry or null if not found
   */
  async get(id: string): Promise<MemoryEntry | null> {
    await this.ensureInitialized();

    const results = await this.table!
      .query()
      .where(`id = '${id}'`)
      .limit(1)
      .toArray();

    if (results.length === 0) {
      return null;
    }

    return this.recordToEntry(results[0]);
  }

  /**
   * Update an existing memory entry.
   * Re-generates embedding if content changes.
   * @param id - Entry ID
   * @param partial - Partial entry with fields to update
   * @returns Updated entry or null if not found
   */
  async update(id: string, partial: Partial<Omit<MemoryEntry, 'id' | 'createdAt'>>): Promise<MemoryEntry | null> {
    await this.ensureInitialized();

    // Get existing entry
    const existing = await this.get(id);
    if (!existing) {
      return null;
    }

    // Merge updates
    const updated: MemoryEntry = {
      ...existing,
      ...partial,
      id: existing.id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation time
      updatedAt: new Date().toISOString(),
    };

    // Validate updated entry
    validateMemoryEntry(updated);

    // Re-generate embedding if content changed
    let vector: number[];
    if (partial.content && partial.content !== existing.content) {
      vector = await this.embeddingProvider.generateEmbedding(updated.content);
    } else {
      // Keep existing embedding - fetch it from the record
      const existingRecord = await this.table!
        .query()
        .where(`id = '${id}'`)
        .limit(1)
        .toArray();
      // Convert to plain array to avoid LanceDB proxy object issues
      vector = Array.from(existingRecord[0].vector);
    }

    // Convert to LanceDB record
    const record: LanceDBRecord = {
      id: updated.id,
      type: updated.type,
      content: updated.content,
      summary: updated.summary ?? '', // LanceDB schema requires all fields to be present
      tags: JSON.stringify(updated.tags),
      source: JSON.stringify(updated.source),
      metadata: JSON.stringify(updated.metadata ?? {}),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      vector,
    };

    // Delete old record and insert updated one
    await this.table!.delete(`id = '${id}'`);
    await this.table!.add([record]);

    return updated;
  }

  /**
   * Delete a memory entry by ID.
   * @param id - Entry ID
   * @returns True if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized();

    // Check if entry exists
    const existing = await this.get(id);
    if (!existing) {
      return false;
    }

    // Delete the record
    await this.table!.delete(`id = '${id}'`);

    return true;
  }

  /**
   * List all memory entries of a specific type.
   * @param type - Memory type filter
   * @returns Array of memory entries
   */
  async listByType(type: MemoryType): Promise<MemoryEntry[]> {
    await this.ensureInitialized();

    const results = await this.table!
      .query()
      .where(`type = '${type}'`)
      .toArray();

    return results.map((record: LanceDBRecord) => this.recordToEntry(record));
  }

  /**
   * Close the database connection.
   */
  async close(): Promise<void> {
    if (this.db) {
      // LanceDB connection doesn't need explicit close in current version
      this.db = null;
      this.table = null;
      this.initialized = false;
    }
  }

  /**
   * Ensure the store is initialized before operations.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Convert LanceDB record to MemoryEntry.
   */
  private recordToEntry(record: LanceDBRecord): MemoryEntry {
    return {
      id: record.id,
      type: record.type as MemoryType,
      content: record.content,
      summary: record.summary && record.summary !== '' ? record.summary : undefined,
      tags: JSON.parse(record.tags),
      source: JSON.parse(record.source),
      metadata: JSON.parse(record.metadata),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
