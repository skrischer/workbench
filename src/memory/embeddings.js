// src/memory/embeddings.ts — Embedding Generation Provider
import { pipeline } from '@xenova/transformers';
/**
 * Embedding provider using local transformer models via @xenova/transformers.
 * Works offline once the model is downloaded.
 */
export class EmbeddingProvider {
    pipeline = null;
    model;
    dimensions;
    /**
     * Creates an embedding provider with the specified model.
     * @param model - Model identifier (default: 'Xenova/all-MiniLM-L6-v2')
     * @param dimensions - Expected embedding dimensions (default: 384)
     */
    constructor(model = 'Xenova/all-MiniLM-L6-v2', dimensions = 384) {
        this.model = model;
        this.dimensions = dimensions;
    }
    /**
     * Initialize the embedding pipeline.
     * Downloads the model on first run (cached for subsequent runs).
     */
    async initialize() {
        if (this.pipeline) {
            return; // Already initialized
        }
        try {
            this.pipeline = await pipeline('feature-extraction', this.model);
        }
        catch (error) {
            throw new Error(`Failed to initialize embedding model ${this.model}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Generate embedding vector for the given text.
     * @param text - Text to embed
     * @returns number[] embedding vector (for LanceDB compatibility)
     */
    async generateEmbedding(text) {
        if (!this.pipeline) {
            await this.initialize();
        }
        if (!text || text.trim() === '') {
            throw new Error('Cannot generate embedding for empty text');
        }
        try {
            const output = await this.pipeline(text, {
                pooling: 'mean',
                normalize: true,
            });
            // Extract the embedding data
            const embedding = output.data;
            // Validate dimensions
            if (embedding.length !== this.dimensions) {
                throw new Error(`Unexpected embedding dimensions: expected ${this.dimensions}, got ${embedding.length}`);
            }
            // Convert Float32Array to number[] for LanceDB compatibility
            return Array.from(embedding);
        }
        catch (error) {
            throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get the embedding dimensions for this provider.
     */
    getDimensions() {
        return this.dimensions;
    }
    /**
     * Get the model name for this provider.
     */
    getModel() {
        return this.model;
    }
}
