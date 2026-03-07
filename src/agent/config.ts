// src/agent/config.ts — Agent Configuration Management

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AgentConfig } from '../types/index.js';

/**
 * Default agent configuration with sensible defaults
 */
export const defaultAgentConfig: AgentConfig = {
  model: 'claude-sonnet-4-20250514',
  systemPrompt: 'You are a helpful coding assistant with access to tools.',
  maxSteps: 25,
  tools: [],
};

/**
 * Validates an agent configuration
 * @param config - Configuration to validate
 * @throws Error if validation fails
 */
export function validateConfig(config: AgentConfig): void {
  if (!config.model || config.model.trim() === '') {
    throw new Error('Agent config: model must not be empty');
  }

  if (config.maxSteps <= 0) {
    throw new Error('Agent config: maxSteps must be greater than 0');
  }

  // systemPrompt is allowed to be empty (though not recommended)
  // tools can be undefined or empty array
}

/**
 * Loads agent configuration from a JSON file, merged with defaults
 * @param path - Optional path to config file (relative or absolute)
 * @returns Merged configuration
 */
export async function loadAgentConfig(path?: string): Promise<AgentConfig> {
  let fileConfig: Partial<AgentConfig> = {};

  if (path) {
    try {
      const absolutePath = resolve(path);
      const content = await readFile(absolutePath, 'utf-8');
      fileConfig = JSON.parse(content) as Partial<AgentConfig>;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load agent config from ${path}: ${error.message}`);
      }
      throw error;
    }
  }

  // Shallow merge: file config overrides defaults
  const merged: AgentConfig = {
    ...defaultAgentConfig,
    ...fileConfig,
  };

  validateConfig(merged);

  return merged;
}
