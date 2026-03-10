// src/config/user-config.ts — User Configuration Interface

import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

/**
 * User configuration settings
 * Stored in ~/.workbench/user-config.json
 */
export interface UserConfig {
  /**
   * Enable automatic session summarization after each run
   * @default true
   */
  autoSummarize?: boolean;

  /**
   * Minimum number of messages required for auto-summarization
   * @default 3
   */
  minMessagesForSummary?: number;
}

/**
 * Default user configuration
 */
export const DEFAULT_USER_CONFIG: Required<UserConfig> = {
  autoSummarize: true,
  minMessagesForSummary: 3,
};

/**
 * Load user configuration from ~/.workbench/user-config.json
 * Creates file with defaults if it doesn't exist
 */
export async function loadUserConfig(configPath?: string): Promise<UserConfig> {
  const path = configPath ?? join(homedir(), '.workbench', 'user-config.json');

  try {
    const content = await readFile(path, 'utf-8');
    const config = JSON.parse(content) as UserConfig;
    
    // Merge with defaults
    return {
      ...DEFAULT_USER_CONFIG,
      ...config,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, create it with defaults
      await ensureUserConfigFile(path);
      return { ...DEFAULT_USER_CONFIG };
    }
    
    // Other errors (permission, invalid JSON, etc.)
    throw new Error(`Failed to load user config from ${path}: ${error}`);
  }
}

/**
 * Save user configuration to ~/.workbench/user-config.json
 */
export async function saveUserConfig(config: UserConfig, configPath?: string): Promise<void> {
  const path = configPath ?? join(homedir(), '.workbench', 'user-config.json');
  
  try {
    // Ensure parent directory exists
    const { dirname } = await import('node:path');
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });
    
    // Write config file
    await writeFile(path, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save user config to ${path}: ${error}`);
  }
}

/**
 * Ensure user config file exists with default values
 */
async function ensureUserConfigFile(path: string): Promise<void> {
  try {
    // Ensure directory exists
    await mkdir(join(homedir(), '.workbench'), { recursive: true });
    
    // Create file with defaults
    await writeFile(path, JSON.stringify(DEFAULT_USER_CONFIG, null, 2), 'utf-8');
  } catch (error) {
    // Ignore if directory/file creation fails (permission issues, etc.)
    // loadUserConfig will return defaults anyway
  }
}
