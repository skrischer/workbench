// src/tools/remember.ts — Remember Tool for Memory Storage
import { BaseTool } from './base.js';
/**
 * Tool for saving information to long-term memory.
 * Stores content with optional type classification and tags.
 */
export class RememberTool extends BaseTool {
    name = 'remember';
    description = 'Save information to long-term memory. Use this to store important facts, decisions, preferences, or knowledge for future recall.';
    inputSchema = {
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
    memoryStore;
    /**
     * Creates a RememberTool instance.
     * @param memoryStore - LanceDB memory store instance
     */
    constructor(memoryStore) {
        super();
        this.memoryStore = memoryStore;
    }
    async execute(input) {
        const content = input.content;
        const type = input.type ?? 'knowledge';
        const tags = input.tags ?? [];
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
        }
        catch (err) {
            const error = err;
            return {
                success: false,
                output: '',
                error: `Failed to save memory: ${error.message}`,
            };
        }
    }
}
