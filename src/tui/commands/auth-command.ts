// src/tui/commands/auth-command.ts — Interactive OAuth PKCE Setup (migrated from src/cli/)

import { Command } from 'commander';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { homedir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { TokenStorage } from '../../llm/token-storage.js';
import { TokenRefresher } from '../../llm/token-refresh.js';
import { ANTHROPIC_CLIENT_ID, ANTHROPIC_TOKEN_URL, TOKEN_REFRESH_BUFFER_MS } from '../../llm/constants.js';
import type { TokenFile } from '../../types/index.js';

const AUTHORIZE_URL = 'https://claude.ai/oauth/authorize';
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
const SCOPES = 'org:create_api_key user:profile user:inference';

/**
 * Generate PKCE parameters (verifier and challenge)
 */
function generatePKCE(): { verifier: string; challenge: string } {
  const randomBytes = crypto.randomBytes(32);
  const verifier = randomBytes.toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(
  code: string,
  state: string,
  verifier: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const requestBody = {
    grant_type: 'authorization_code',
    client_id: ANTHROPIC_CLIENT_ID,
    code,
    state,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  };

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
  } catch (error) {
    throw new Error(`Network error during token exchange: ${error}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Token exchange failed with status ${response.status}: ${errorText}`);
  }

  return await response.json();
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
 * Format time until expiry in human-readable format
 */
function formatTimeUntilExpiry(expiresTimestamp: number): string {
  const now = Date.now();
  const msUntilExpiry = expiresTimestamp - now;

  if (msUntilExpiry < 0) {
    const hoursAgo = Math.floor(Math.abs(msUntilExpiry) / (1000 * 60 * 60));
    return `Expired ${hoursAgo} hours ago`;
  }

  const hours = Math.floor(msUntilExpiry / (1000 * 60 * 60));
  const minutes = Math.floor((msUntilExpiry % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} days`;
  } else if (hours > 0) {
    return `${hours} hours, ${minutes} minutes`;
  } else {
    return `${minutes} minutes`;
  }
}

export async function interactiveAuth(): Promise<void> {
  console.log('OAuth PKCE Setup\n');

  const { verifier, challenge } = generatePKCE();

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set('code', 'true');
  authUrl.searchParams.set('client_id', ANTHROPIC_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', verifier);

  console.log('Please follow these steps:');
  console.log(`1. Visit this URL:\n   ${authUrl.toString()}\n`);
  console.log('2. Authorize the application in your browser');
  console.log('3. After redirect, copy the full code#state string from the callback URL\n');
  console.log('   Example: abc123def456...#xyz789abc123...\n');

  const rl = readline.createInterface({ input, output });

  try {
    const codeState = await rl.question('? Enter code#state string: ');

    if (!codeState.includes('#')) {
      throw new Error('Invalid format. Expected code#state string with # separator');
    }

    const [code, state] = codeState.trim().split('#');

    if (!code || !state) {
      throw new Error('Missing code or state component');
    }

    console.log('\nExchanging authorization code for tokens...');

    const tokenData = await exchangeCodeForTokens(code, state, verifier);

    const expiresAtMs = Date.now() + (tokenData.expires_in * 1000) - TOKEN_REFRESH_BUFFER_MS;

    const tokenPath = path.join(homedir(), '.workbench', 'tokens.json');
    const storage = new TokenStorage(tokenPath);

    const tokens: TokenFile = {
      anthropic: {
        type: 'oauth',
        access: tokenData.access_token,
        refresh: tokenData.refresh_token,
        expires: expiresAtMs
      }
    };

    await storage.save(tokens);

    console.log(`\nOAuth tokens saved to ${tokenPath}`);
    console.log(`Access token expires in: ${formatTimeUntilExpiry(expiresAtMs)}`);
  } finally {
    rl.close();
  }
}

async function showStatus(): Promise<void> {
  const tokenPath = path.join(homedir(), '.workbench', 'tokens.json');
  const storage = new TokenStorage(tokenPath);

  try {
    const tokens = await storage.load();
    const { anthropic } = tokens;

    console.log('Tokens configured');
    console.log(`Access Token: ${maskToken(anthropic.access)}`);
    console.log(`Refresh Token: ${maskToken(anthropic.refresh)}`);
    console.log(`Token file: ${tokenPath}`);
    console.log(`Expires in: ${formatTimeUntilExpiry(anthropic.expires)}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      console.error('No tokens configured');
      console.log('Run: workbench auth');
      process.exit(1);
    }
    throw error;
  }
}

async function refreshTokens(): Promise<void> {
  const tokenPath = path.join(homedir(), '.workbench', 'tokens.json');
  const storage = new TokenStorage(tokenPath);
  const refresher = new TokenRefresher(storage);

  try {
    console.log('Refreshing tokens...');
    await refresher.ensureValidToken();
    console.log('Tokens refreshed successfully');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      console.error('No tokens found');
      console.log('Run: workbench auth');
    } else {
      console.error(`Refresh failed: ${error}`);
    }
    process.exit(1);
  }
}

export function createAuthCommand(): Command {
  const cmd = new Command('auth');
  cmd.description('Manage OAuth tokens for Workbench');

  cmd.action(async () => {
    try {
      await interactiveAuth();
    } catch (error) {
      console.error(`Auth setup failed: ${error}`);
      process.exit(1);
    }
  });

  cmd
    .command('status')
    .description('Show current token status')
    .action(async () => {
      await showStatus();
    });

  cmd
    .command('refresh')
    .description('Refresh OAuth tokens')
    .action(async () => {
      await refreshTokens();
    });

  return cmd;
}
