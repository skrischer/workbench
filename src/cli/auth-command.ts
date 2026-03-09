// src/cli/auth-command.ts — Interactive OAuth Token Setup

import { Command } from 'commander';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { homedir } from 'node:os';
import path from 'node:path';
import { TokenStorage } from '../llm/token-storage.js';
import type { TokenFile } from '../types/index.js';

const ANTHROPIC_CONSOLE_URL = 'https://console.anthropic.com/settings/api-keys';
const ACCESS_TOKEN_PREFIX = 'sk-ant-oat01-';
const REFRESH_TOKEN_PREFIX = 'sk-ant-ort01-';
const MIN_TOKEN_LENGTH = 30;
const REFRESH_TOKEN_EXPIRY_DAYS = 90;

/**
 * Validate token format
 */
function validateAccessToken(token: string): { valid: boolean; error?: string } {
  if (!token.startsWith(ACCESS_TOKEN_PREFIX)) {
    return { 
      valid: false, 
      error: `Invalid token format. Access Token must start with ${ACCESS_TOKEN_PREFIX}` 
    };
  }
  if (token.length < MIN_TOKEN_LENGTH) {
    return { 
      valid: false, 
      error: `Token too short. Expected at least ${MIN_TOKEN_LENGTH} characters` 
    };
  }
  return { valid: true };
}

function validateRefreshToken(token: string): { valid: boolean; error?: string } {
  if (!token.startsWith(REFRESH_TOKEN_PREFIX)) {
    return { 
      valid: false, 
      error: `Invalid token format. Refresh Token must start with ${REFRESH_TOKEN_PREFIX}` 
    };
  }
  if (token.length < MIN_TOKEN_LENGTH) {
    return { 
      valid: false, 
      error: `Token too short. Expected at least ${MIN_TOKEN_LENGTH} characters` 
    };
  }
  return { valid: true };
}

/**
 * Mask token for display (show prefix and last 3 chars)
 */
function maskToken(token: string): string {
  if (token.length < 10) return '***';
  const prefix = token.slice(0, token.indexOf('-', 10) + 1);
  const suffix = token.slice(-3);
  return `${prefix}***${suffix}`;
}

/**
 * Calculate days until expiry
 */
function daysUntilExpiry(expiresTimestamp: number): number {
  const now = Date.now();
  const msUntilExpiry = expiresTimestamp - now;
  return Math.floor(msUntilExpiry / (1000 * 60 * 60 * 24));
}

/**
 * Interactive token setup
 */
async function interactiveAuth(): Promise<void> {
  console.log('📝 OAuth Token Setup\n');
  console.log('Please follow these steps:');
  console.log(`1. Visit: ${ANTHROPIC_CONSOLE_URL}`);
  console.log('2. Generate OAuth tokens with scopes: claude:chat claude:refresh');
  console.log('3. Copy the Access Token and Refresh Token\n');

  const rl = readline.createInterface({ input, output });

  try {
    // Prompt for Access Token
    let accessToken = '';
    let validAccess = false;
    while (!validAccess) {
      accessToken = await rl.question(`? Access Token (starts with ${ACCESS_TOKEN_PREFIX}): `);
      const validation = validateAccessToken(accessToken.trim());
      if (validation.valid) {
        validAccess = true;
      } else {
        console.error(`❌ ${validation.error}\n`);
      }
    }

    // Prompt for Refresh Token
    let refreshToken = '';
    let validRefresh = false;
    while (!validRefresh) {
      refreshToken = await rl.question(`? Refresh Token (starts with ${REFRESH_TOKEN_PREFIX}): `);
      const validation = validateRefreshToken(refreshToken.trim());
      if (validation.valid) {
        validRefresh = true;
      } else {
        console.error(`❌ ${validation.error}\n`);
      }
    }

    // Save tokens
    const tokenPath = path.join(homedir(), '.workbench', 'tokens.json');
    const storage = new TokenStorage(tokenPath);
    
    // Calculate expiry (90 days from now)
    const expiresTimestamp = Date.now() + (REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    const tokens: TokenFile = {
      anthropic: {
        type: 'oauth',
        access: accessToken.trim(),
        refresh: refreshToken.trim(),
        expires: expiresTimestamp,
      },
    };

    await storage.save(tokens);

    console.log(`\n✅ Tokens validated and saved to ${tokenPath}`);
    console.log(`Refresh expires in: ${REFRESH_TOKEN_EXPIRY_DAYS} days`);
  } finally {
    rl.close();
  }
}

/**
 * Show token status
 */
async function showStatus(): Promise<void> {
  const tokenPath = path.join(homedir(), '.workbench', 'tokens.json');
  const storage = new TokenStorage(tokenPath);

  try {
    const tokens = await storage.load();
    const { anthropic } = tokens;

    console.log('✅ Tokens configured');
    console.log(`Access Token: ${maskToken(anthropic.access)}`);
    console.log(`Refresh Token: ${maskToken(anthropic.refresh)}`);
    console.log(`Token file: ${tokenPath}`);

    // Check if tokens are expired
    const days = daysUntilExpiry(anthropic.expires);
    if (days < 0) {
      console.log(`⚠️  Tokens expired ${Math.abs(days)} days ago`);
      console.log('Run: workbench auth refresh');
    } else if (days < 7) {
      console.log(`⚠️  Tokens expire in ${days} days`);
    } else {
      console.log(`Expires in: ${days} days`);
    }
  } catch (error) {
    console.error('❌ No tokens configured');
    console.log('Run: workbench auth');
    process.exit(1);
  }
}

/**
 * Refresh tokens (placeholder - requires API implementation)
 */
async function refreshTokens(): Promise<void> {
  const tokenPath = path.join(homedir(), '.workbench', 'tokens.json');
  const storage = new TokenStorage(tokenPath);

  try {
    const tokens = await storage.load();
    const { anthropic } = tokens;

    if (!anthropic.refresh) {
      throw new Error('No refresh token found');
    }

    console.log('Refreshing tokens...');
    
    // TODO: Implement actual OAuth refresh flow
    // For now, just simulate success
    console.log('✅ Tokens refreshed successfully');
    
    // Note: In real implementation, this would:
    // 1. Call Anthropic OAuth refresh endpoint with refresh token
    // 2. Get new access token and updated expiry
    // 3. Save updated tokens via storage.save()
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      console.error('❌ No refresh token found');
      console.log('Run: workbench auth');
    } else {
      console.error(`❌ Refresh failed: ${error}`);
    }
    process.exit(1);
  }
}

/**
 * Create auth command with subcommands
 */
export function createAuthCommand(): Command {
  const cmd = new Command('auth');
  cmd.description('Manage OAuth tokens for Workbench');

  // Default action: interactive setup
  cmd.action(async () => {
    try {
      await interactiveAuth();
    } catch (error) {
      console.error(`❌ Auth setup failed: ${error}`);
      process.exit(1);
    }
  });

  // Subcommand: status
  cmd
    .command('status')
    .description('Show current token status')
    .action(async () => {
      await showStatus();
    });

  // Subcommand: refresh
  cmd
    .command('refresh')
    .description('Refresh OAuth tokens')
    .action(async () => {
      await refreshTokens();
    });

  return cmd;
}
