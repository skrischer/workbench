// src/memory/validation.ts — Memory Entry and Query Validation
const VALID_MEMORY_TYPES = ['session', 'project', 'knowledge', 'preference'];
const VALID_SOURCE_TYPES = ['session', 'user', 'tool', 'import'];
/**
 * Validates a memory entry for correctness and completeness.
 * @param entry - The memory entry to validate
 * @throws Error if validation fails
 */
export function validateMemoryEntry(entry) {
    // Check required fields
    if (!entry.id || typeof entry.id !== 'string') {
        throw new Error('Memory entry must have a valid id');
    }
    if (!entry.content || typeof entry.content !== 'string' || entry.content.trim() === '') {
        throw new Error('Memory entry content cannot be empty');
    }
    // Validate memory type
    if (!VALID_MEMORY_TYPES.includes(entry.type)) {
        throw new Error(`Invalid memory type: ${entry.type}. Must be one of: ${VALID_MEMORY_TYPES.join(', ')}`);
    }
    // Validate tags
    if (!Array.isArray(entry.tags)) {
        throw new Error('Memory entry tags must be an array');
    }
    if (!entry.tags.every((tag) => typeof tag === 'string')) {
        throw new Error('All tags must be strings');
    }
    // Validate source
    if (!entry.source || typeof entry.source !== 'object') {
        throw new Error('Memory entry must have a valid source');
    }
    if (!VALID_SOURCE_TYPES.includes(entry.source.type)) {
        throw new Error(`Invalid source type: ${entry.source.type}. Must be one of: ${VALID_SOURCE_TYPES.join(', ')}`);
    }
    // Validate timestamps
    if (!entry.createdAt || typeof entry.createdAt !== 'string') {
        throw new Error('Memory entry must have a valid createdAt timestamp');
    }
    if (!entry.updatedAt || typeof entry.updatedAt !== 'string') {
        throw new Error('Memory entry must have a valid updatedAt timestamp');
    }
}
/**
 * Validates a memory query for correctness.
 * @param query - The memory query to validate
 * @throws Error if validation fails
 */
export function validateQuery(query) {
    // Check required fields
    if (!query.text || typeof query.text !== 'string' || query.text.trim() === '') {
        throw new Error('Query text cannot be empty');
    }
    // Validate optional type
    if (query.type !== undefined && !VALID_MEMORY_TYPES.includes(query.type)) {
        throw new Error(`Invalid memory type: ${query.type}. Must be one of: ${VALID_MEMORY_TYPES.join(', ')}`);
    }
    // Validate optional tags
    if (query.tags !== undefined) {
        if (!Array.isArray(query.tags)) {
            throw new Error('Query tags must be an array');
        }
        if (!query.tags.every((tag) => typeof tag === 'string')) {
            throw new Error('All tags must be strings');
        }
    }
    // Validate optional limit
    if (query.limit !== undefined) {
        if (typeof query.limit !== 'number' || query.limit <= 0) {
            throw new Error('Query limit must be a positive number');
        }
    }
    // Validate optional minScore
    if (query.minScore !== undefined) {
        if (typeof query.minScore !== 'number' || query.minScore < 0 || query.minScore > 1) {
            throw new Error('Query minScore must be between 0 and 1');
        }
    }
}
