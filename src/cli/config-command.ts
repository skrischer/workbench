// src/cli/config-command.ts — CLI config command implementation

import { Command } from 'commander';
import { loadUserConfig, saveUserConfig, type UserConfig } from '../config/user-config.js';

/**
 * Show current configuration
 */
async function showConfig(): Promise<void> {
  const config = await loadUserConfig();

  console.log('📋 Workbench Configuration');
  console.log('');
  console.log(`  autoSummarize:        ${config.autoSummarize}`);
  console.log(`  summarizerModel:      ${config.summarizerModel}`);
  console.log(`  memoryRetentionDays:  ${config.memoryRetentionDays}`);
  console.log('');
}

/**
 * Get a specific config value
 */
async function getConfigValue(key: string): Promise<void> {
  const config = await loadUserConfig();

  if (!(key in config)) {
    console.error(`❌ Unknown config key: ${key}`);
    console.error('');
    console.error('Valid keys: autoSummarize, summarizerModel, memoryRetentionDays');
    process.exit(1);
  }

  const value = config[key as keyof UserConfig];
  console.log(value);
}

/**
 * Set a config value
 */
async function setConfigValue(key: string, value: string): Promise<void> {
  const validKeys: (keyof UserConfig)[] = ['autoSummarize', 'summarizerModel', 'memoryRetentionDays'];

  if (!validKeys.includes(key as keyof UserConfig)) {
    console.error(`❌ Unknown config key: ${key}`);
    console.error('');
    console.error(`Valid keys: ${validKeys.join(', ')}`);
    process.exit(1);
  }

  // Parse value based on key type
  let parsedValue: boolean | string | number;

  if (key === 'autoSummarize') {
    if (value !== 'true' && value !== 'false') {
      console.error(`❌ Invalid value for ${key}: must be 'true' or 'false'`);
      process.exit(1);
    }
    parsedValue = value === 'true';
  } else if (key === 'memoryRetentionDays') {
    parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue) || parsedValue < 0) {
      console.error(`❌ Invalid value for ${key}: must be a non-negative integer`);
      process.exit(1);
    }
  } else {
    // summarizerModel → string
    parsedValue = value;
  }

  // Save config
  await saveUserConfig({ [key]: parsedValue });

  console.log(`✅ Config updated: ${key} = ${parsedValue}`);
}

/**
 * Create the config command for Commander.js
 */
export function createConfigCommand(): Command {
  const command = new Command('config');

  command
    .description('Manage Workbench configuration')
    .action(async () => {
      // No subcommand → show config
      await showConfig();
    });

  // config get <key>
  command
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Configuration key')
    .action(async (key: string) => {
      await getConfigValue(key);
    });

  // config set <key> <value>
  command
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key')
    .argument('<value>', 'Configuration value')
    .action(async (key: string, value: string) => {
      await setConfigValue(key, value);
    });

  return command;
}
