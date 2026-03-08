// src/tools/recall.ts — Recall Tool for Memory Search
import { BaseTool } from './base.js';
/**
 * Tool for searching and retrieving information from long-term memory.
 * Uses semantic search to find relevant memories.
 */
export class RecallTool extends BaseTool {
    name = 'recall';
    description = 'Search for information in long-term memory using semantic search. Returns relevant memories ranked by similarity.';
    inputSchema = {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query (natural language)',
            },
            type: {
                type: 'string',
                enum: ['session', 'project', 'knowledge', 'preference'],
                description: 'Optional: filter by memory type',
            },
            limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                minimum: 1,
                maximum: 20,
            },
        },
        required: ['query'],
    };
    memoryStore;
    /**
     * Creates a RecallTool instance.
     * @param memoryStore - LanceDB memory store instance
     */
    constructor(memoryStore) {
        super();
        this.memoryStore = memoryStore;
    }
    async execute(input) {
        const query = input.query;
        const type = input.type;
        const limit = input.limit ?? 5;
        try {
            // Ensure store is initialized
            await this.memoryStore.init();
            // Search memory store
            const results = await this.memoryStore.search({
                text: query,
                type,
                limit,
            });
            // Format results for output
            if (results.length === 0) {
                return {
                    success: true,
                    output: 'No relevant memories found.',
                    metadata: {
                        query,
                        type,
                        count: 0,
                    },
                };
            }
            // Build formatted output
            const formattedResults = results.map((result, index) => {
                const { entry, score } = result;
                const relevance = (score * 100).toFixed(1);
                const tags = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
                return [
                    `${index + 1}. [${entry.type}] (${relevance}% relevant)${tags}`,
                    `   ${entry.content}`,
                    `   (ID: ${entry.id}, Created: ${new Date(entry.createdAt).toLocaleDateString()})`,
                ].join('\n');
            }).join('\n\n');
            const output = `Found ${results.length} relevant ${results.length === 1 ? 'memory' : 'memories'}:\n\n${formattedResults}`;
            return {
                success: true,
                output,
                metadata: {
                    query,
                    type,
                    count: results.length,
                    results: results.map((r) => ({
                        id: r.entry.id,
                        type: r.entry.type,
                        score: r.score,
                        tags: r.entry.tags,
                    })),
                },
            };
        }
        catch (err) {
            const error = err;
            return {
                success: false,
                output: '',
                error: `Failed to search memory: ${error.message}`,
            };
        }
    }
}
