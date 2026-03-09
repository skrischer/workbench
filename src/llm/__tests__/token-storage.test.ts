// src/llm/__tests__/token-storage.test.ts — Tests for TokenStorage

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TokenStorage } from '../token-storage.js';
import type { TokenFile, TokenData } from '../../types/index.js';

describe('TokenStorage', () => {
  let testDir: string;
  let tokenPath: string;
  let storage: TokenStorage;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `token-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    tokenPath = join(testDir, 'tokens.json');
    storage = new TokenStorage(tokenPath);
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('should successfully read and write tokens (roundtrip)', async () => {
    const testTokens: TokenFile = {
      anthropic: {
        type: 'oauth',
        access: 'test-access-token',
        refresh: 'test-refresh-token',
        expires: Date.now() + 3600000 // 1 hour from now
      }
    };

    // Write tokens
    await storage.save(testTokens);

    // Read tokens back
    const loadedTokens = await storage.load();

    expect(loadedTokens).toEqual(testTokens);
    expect(loadedTokens.anthropic.access).toBe('test-access-token');
    expect(loadedTokens.anthropic.refresh).toBe('test-refresh-token');
  });

  it('should handle file locking during concurrent writes', async () => {
    const token1: TokenFile = {
      anthropic: {
        type: 'oauth',
        access: 'token-1',
        refresh: 'refresh-1',
        expires: Date.now() + 3600000
      }
    };

    const token2: TokenFile = {
      anthropic: {
        type: 'oauth',
        access: 'token-2',
        refresh: 'refresh-2',
        expires: Date.now() + 3600000
      }
    };

    // Attempt concurrent writes
    await Promise.all([
      storage.save(token1),
      storage.save(token2)
    ]);

    // One of the writes should succeed
    const result = await storage.load();
    expect(['token-1', 'token-2']).toContain(result.anthropic.access);
  });

  it('should throw error when loading corrupt JSON file', async () => {
    // Write invalid JSON to file
    await writeFile(tokenPath, '{ invalid json here }', 'utf-8');

    await expect(storage.load()).rejects.toThrow('Failed to load token file');
  });

  it('should throw ENOENT error when token file does not exist', async () => {
    // Don't create the file - just try to load
    await expect(storage.load()).rejects.toThrow('Token file not found');
  });

  it('should correctly detect expired tokens', () => {
    const expiredToken: TokenData = {
      type: 'oauth',
      access: 'expired-token',
      refresh: 'refresh-token',
      expires: Date.now() - 1000 // 1 second ago
    };

    expect(storage.isExpired(expiredToken)).toBe(true);
  });

  it('should correctly detect valid tokens', () => {
    const validToken: TokenData = {
      type: 'oauth',
      access: 'valid-token',
      refresh: 'refresh-token',
      expires: Date.now() + 3600000 // 1 hour from now
    };

    expect(storage.isExpired(validToken)).toBe(false);
  });

  it('should detect tokens expiring exactly now as expired', () => {
    const nowToken: TokenData = {
      type: 'oauth',
      access: 'now-token',
      refresh: 'refresh-token',
      expires: Date.now()
    };

    expect(storage.isExpired(nowToken)).toBe(true);
  });

  it('should successfully return access token when valid', async () => {
    const testTokens: TokenFile = {
      anthropic: {
        type: 'oauth',
        access: 'valid-access-token',
        refresh: 'valid-refresh-token',
        expires: Date.now() + 3600000 // 1 hour from now
      }
    };

    await storage.save(testTokens);

    const accessToken = await storage.getAccessToken();
    expect(accessToken).toBe('valid-access-token');
  });

  it('should throw error when getAccessToken called with expired token', async () => {
    const testTokens: TokenFile = {
      anthropic: {
        type: 'oauth',
        access: 'expired-access-token',
        refresh: 'expired-refresh-token',
        expires: Date.now() - 1000 // 1 second ago
      }
    };

    await storage.save(testTokens);

    await expect(storage.getAccessToken()).rejects.toThrow('Access token has expired');
  });

  it('should create token file in nested directory structure', async () => {
    // Create the parent directory structure first (necessary for lock file)
    const nestedDir = join(testDir, 'nested', 'deep');
    await mkdir(nestedDir, { recursive: true });
    
    const nestedPath = join(nestedDir, 'tokens.json');
    const nestedStorage = new TokenStorage(nestedPath);

    const testTokens: TokenFile = {
      anthropic: {
        type: 'oauth',
        access: 'nested-token',
        refresh: 'nested-refresh',
        expires: Date.now() + 3600000
      }
    };

    // Should successfully save in nested directory
    await nestedStorage.save(testTokens);

    const loaded = await nestedStorage.load();
    expect(loaded.anthropic.access).toBe('nested-token');
  });
});
