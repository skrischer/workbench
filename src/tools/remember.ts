// src/tools/remember.ts — Remember Tool for Memory Storage

import { BaseTool } from './base.js';
import type { ToolResult } from '../types/index.js';
import type { LanceDBMemoryStore } from '../memory/lancedb-store.js';
import type { MemoryType } from '../types/memory.js';

/**
 * Tool for saving information to long-term memory.
 * Stores content with optional type classification and tags.
 */
export class RememberTool extends BaseTool {
  readonly name = 'remember';
  readonly description = 'Save information to long-term memory. Use this to store important facts, decisions, preferences, or knowledge for future recall.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The information to remember (text content)',
      },
      type: {
        type: 'string',
        enum: ['session', 'project', 'knowledge', 'preference'],
        description: 'Type of memory (default: knowledge)',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tags for categorization and search',
      },
    },
    required: ['content'],
  };

  private memoryStore: LanceDBMemoryStore;

  /**
   * Creates a RememberTool instance.
   * @param memoryStore - LanceDB memory store instance
   */
  constructor(memoryStore: LanceDBMemoryStore) {
    super();
    this.memoryStore = memoryStore;
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const content = input.content as string;
    const type = (input.type as MemoryType | undefined) ?? 'knowledge';
    const tags = (input.tags as string[] | undefined) ?? [];

    try {
      // Ensure store is initialized
      await this.memoryStore.init();

      // Add to memory store
      const entry = await this.memoryStore.add({
        content,
        type,
        tags,
        source: { type: 'tool' },
      });

      return {
        success: true,
        output: `Remembered: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
        metadata: {
          id: entry.id,
          type: entry.type,
          tags: entry.tags,
          createdAt: entry.createdAt,
        },
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: '',
        error: `Failed to save memory: ${error.message}`,
      };
    }
  }
}
