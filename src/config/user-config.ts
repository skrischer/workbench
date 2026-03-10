// src/config/user-config.ts — User configuration for Workbench

import { homedir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * User configuration interface
 * Supports Memory-specific settings (auto-summarize, model, retention)
 */
export interface UserConfig {
  /** Automatically summarize sessions after completion (default: true) */
  autoSummarize?: boolean;

  /** Model to use for session summarization (default: "anthropic/claude-haiku-4") */
  summarizerModel?: string;

  /** Memory retention policy in days (0 = unlimited, default: 90) */
  memoryRetentionDays?: number;

  /** Minimum number of messages required for auto-summarization (default: 3) */
  minMessagesForSummary?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_USER_CONFIG: Required<UserConfig> = {
  autoSummarize: true,
  summarizerModel: 'anthropic/claude-haiku-4',
  memoryRetentionDays: 90,
  minMessagesForSummary: 3,
};

/**
 * Get Workbench home directory
 */
function getWorkbenchHome(): string {
  return process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
}

/**
 * Get user config file path
 */
function getUserConfigPath(): string {
  return path.join(getWorkbenchHome(), 'config.json');
}

/**
 * Load user configuration from file with defaults
 * @returns Merged configuration (file values override defaults)
 */
export async function loadUserConfig(): Promise<Required<UserConfig>> {
  const configPath = getUserConfigPath();

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const fileConfig: Partial<UserConfig> = JSON.parse(content);

    // Merge with defaults (file config overrides defaults)
    return {
      autoSummarize: fileConfig.autoSummarize ?? DEFAULT_USER_CONFIG.autoSummarize,
      summarizerModel: fileConfig.summarizerModel ?? DEFAULT_USER_CONFIG.summarizerModel,
      memoryRetentionDays: fileConfig.memoryRetentionDays ?? DEFAULT_USER_CONFIG.memoryRetentionDays,
      minMessagesForSummary: fileConfig.minMessagesForSummary ?? DEFAULT_USER_CONFIG.minMessagesForSummary,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Config file doesn't exist → return defaults
      return { ...DEFAULT_USER_CONFIG };
    }

    // Other errors (parse error, permission issue) → throw
    throw new Error(`Failed to load user config from ${configPath}: ${(error as Error).message}`);
  }
}

/**
 * Save user configuration to file
 * @param config - Configuration to save (partial updates allowed)
 */
export async function saveUserConfig(config: Partial<UserConfig>): Promise<void> {
  const configPath = getUserConfigPath();
  const workbenchHome = getWorkbenchHome();

  // Ensure Workbench home directory exists
  await fs.mkdir(workbenchHome, { recursive: true });

  // Load existing config
  const existingConfig = await loadUserConfig();

  // Merge with new values
  const mergedConfig: UserConfig = {
    autoSummarize: config.autoSummarize ?? existingConfig.autoSummarize,
    summarizerModel: config.summarizerModel ?? existingConfig.summarizerModel,
    memoryRetentionDays: config.memoryRetentionDays ?? existingConfig.memoryRetentionDays,
    minMessagesForSummary: config.minMessagesForSummary ?? existingConfig.minMessagesForSummary,
  };

  // Write to file (pretty-printed JSON)
  await fs.writeFile(configPath, JSON.stringify(mergedConfig, null, 2), 'utf-8');
}

/**
 * Get a specific config value
 * @param key - Config key to retrieve
 * @returns Config value
 */
export async function getConfigValue<K extends keyof UserConfig>(key: K): Promise<Required<UserConfig>[K]> {
  const config = await loadUserConfig();
  return config[key];
}

/**
 * Set a specific config value
 * @param key - Config key to set
 * @param value - Value to set
 */
export async function setConfigValue<K extends keyof UserConfig>(
  key: K,
  value: UserConfig[K]
): Promise<void> {
  await saveUserConfig({ [key]: value });
}
