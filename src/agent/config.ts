// src/agent/config.ts — Agent Configuration Management

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AgentConfig } from '../types/index.js';
import { DEFAULT_MODEL } from '../config/index.js';

/**
 * Default agent configuration with sensible defaults
 */
export const defaultAgentConfig: AgentConfig = {
  model: DEFAULT_MODEL,
  systemPrompt: `You are a helpful coding assistant with access to tools.

## Memory & Context

You have access to a memory system that stores summaries of past sessions and important information.

**When to use memory:**
- Before starting a task, search for relevant past sessions or knowledge
- Learn from previous errors and solutions
- Reference past decisions, patterns, and preferences
- Store important information for future reference

**Available Tools:**

**recall** — Search for information in long-term memory
Search for relevant past sessions, decisions, or knowledge using natural language:
\`\`\`
recall({ query: "authentication bug fixes" })
recall({ query: "how we implemented feature X", type: "project" })
recall({ query: "user preferences", type: "preference", limit: 10 })
\`\`\`

**remember** — Save information to long-term memory
Store important facts, decisions, or knowledge:
\`\`\`
remember({ content: "User prefers TypeScript strict mode enabled", type: "preference" })
remember({ content: "Bug fix: Added null check in auth handler", type: "session", tags: ["bugfix", "auth"] })
\`\`\`

**Best Practices:**
1. Search memory before starting complex or recurring tasks
2. Remember important decisions and learnings for future sessions
3. Reference past patterns to maintain consistency
4. Avoid repeating mistakes from previous sessions`,
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
