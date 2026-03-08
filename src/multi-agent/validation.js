// src/multi-agent/validation.ts — Validation Functions for Multi-Agent System
const VALID_ROLES = ['planner', 'worker', 'reviewer', 'custom'];
const VALID_MESSAGE_TYPES = ['task', 'result', 'status', 'error'];
/**
 * Validate a SpawnConfig before spawning an agent.
 * @param config - The spawn configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateSpawnConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new Error('SpawnConfig must be an object');
    }
    const cfg = config;
    // Role is required
    if (!cfg.role || typeof cfg.role !== 'string' || cfg.role.trim() === '') {
        throw new Error('SpawnConfig must have a non-empty role');
    }
    if (!VALID_ROLES.includes(cfg.role)) {
        throw new Error(`SpawnConfig role must be one of: ${VALID_ROLES.join(', ')} (got: ${cfg.role})`);
    }
    // Optional: name
    if (cfg.name !== undefined && (typeof cfg.name !== 'string' || cfg.name.trim() === '')) {
        throw new Error('SpawnConfig name must be a non-empty string if provided');
    }
    // Optional: model
    if (cfg.model !== undefined && (typeof cfg.model !== 'string' || cfg.model.trim() === '')) {
        throw new Error('SpawnConfig model must be a non-empty string if provided');
    }
    // Optional: systemPrompt
    if (cfg.systemPrompt !== undefined &&
        (typeof cfg.systemPrompt !== 'string' || cfg.systemPrompt.trim() === '')) {
        throw new Error('SpawnConfig systemPrompt must be a non-empty string if provided');
    }
    // Optional: tools (array of strings)
    if (cfg.tools !== undefined) {
        if (!Array.isArray(cfg.tools)) {
            throw new Error('SpawnConfig tools must be an array if provided');
        }
        if (!cfg.tools.every((tool) => typeof tool === 'string' && tool.trim() !== '')) {
            throw new Error('SpawnConfig tools must be an array of non-empty strings');
        }
    }
    // Optional: maxSteps (positive number)
    if (cfg.maxSteps !== undefined) {
        if (typeof cfg.maxSteps !== 'number' || !Number.isInteger(cfg.maxSteps)) {
            throw new Error('SpawnConfig maxSteps must be an integer if provided');
        }
        if (cfg.maxSteps <= 0) {
            throw new Error('SpawnConfig maxSteps must be greater than 0 if provided');
        }
    }
    // Optional: cwd
    if (cfg.cwd !== undefined && (typeof cfg.cwd !== 'string' || cfg.cwd.trim() === '')) {
        throw new Error('SpawnConfig cwd must be a non-empty string if provided');
    }
}
/**
 * Validate an AgentMessage before sending.
 * @param message - The message to validate
 * @throws Error if message is invalid
 */
export function validateAgentMessage(message) {
    if (!message || typeof message !== 'object') {
        throw new Error('AgentMessage must be an object');
    }
    const msg = message;
    // from is required
    if (!msg.from || typeof msg.from !== 'string' || msg.from.trim() === '') {
        throw new Error('AgentMessage must have a non-empty from field');
    }
    // to is required
    if (!msg.to || typeof msg.to !== 'string' || msg.to.trim() === '') {
        throw new Error('AgentMessage must have a non-empty to field');
    }
    // type is required
    if (!msg.type || typeof msg.type !== 'string') {
        throw new Error('AgentMessage must have a type field');
    }
    if (!VALID_MESSAGE_TYPES.includes(msg.type)) {
        throw new Error(`AgentMessage type must be one of: ${VALID_MESSAGE_TYPES.join(', ')} (got: ${msg.type})`);
    }
    // payload is required (can be any value, including null)
    if (!('payload' in msg)) {
        throw new Error('AgentMessage must have a payload field');
    }
    // timestamp is required
    if (!msg.timestamp || typeof msg.timestamp !== 'string' || msg.timestamp.trim() === '') {
        throw new Error('AgentMessage must have a non-empty timestamp field');
    }
}
