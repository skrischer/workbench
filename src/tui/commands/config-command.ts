// src/tui/commands/config-command.ts — CLI config command (migrated from src/cli/)

import { Command } from 'commander';
import { loadUserConfig, saveUserConfig, type UserConfig } from '../../config/user-config.js';

async function showConfig(): Promise<void> {
  const config = await loadUserConfig();

  console.log('Workbench Configuration');
  console.log('');
  console.log(`  autoSummarize:        ${config.autoSummarize}`);
  console.log(`  summarizerModel:      ${config.summarizerModel}`);
  console.log(`  memoryRetentionDays:  ${config.memoryRetentionDays}`);
  console.log('');
}

async function getConfigValue(key: string): Promise<void> {
  const config = await loadUserConfig();

  if (!(key in config)) {
    console.error(`Unknown config key: ${key}`);
    console.error('');
    console.error('Valid keys: autoSummarize, summarizerModel, memoryRetentionDays');
    process.exit(1);
  }

  const value = config[key as keyof UserConfig];
  console.log(value);
}

async function setConfigValue(key: string, value: string): Promise<void> {
  const validKeys: (keyof UserConfig)[] = ['autoSummarize', 'summarizerModel', 'memoryRetentionDays'];

  if (!validKeys.includes(key as keyof UserConfig)) {
    console.error(`Unknown config key: ${key}`);
    console.error('');
    console.error(`Valid keys: ${validKeys.join(', ')}`);
    process.exit(1);
  }

  let parsedValue: boolean | string | number;

  if (key === 'autoSummarize') {
    if (value !== 'true' && value !== 'false') {
      console.error(`Invalid value for ${key}: must be 'true' or 'false'`);
      process.exit(1);
    }
    parsedValue = value === 'true';
  } else if (key === 'memoryRetentionDays') {
    parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue) || parsedValue < 0) {
      console.error(`Invalid value for ${key}: must be a non-negative integer`);
      process.exit(1);
    }
  } else {
    parsedValue = value;
  }

  await saveUserConfig({ [key]: parsedValue });
  console.log(`Config updated: ${key} = ${parsedValue}`);
}

export function createConfigCommand(): Command {
  const command = new Command('config');

  command
    .description('Manage Workbench configuration')
    .action(async () => {
      await showConfig();
    });

  command
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Configuration key')
    .action(async (key: string) => {
      await getConfigValue(key);
    });

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
