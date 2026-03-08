// src/test/__tests__/test-env.test.ts — Tests for test-env helper

import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createTestEnv } from '../test-env.js';
import type { TestEnv } from '../test-env.js';

describe('createTestEnv', () => {
  let testEnv: TestEnv | null = null;

  afterEach(async () => {
    // Clean up after each test
    if (testEnv) {
      await testEnv.cleanup();
      testEnv = null;
    }
  });

  it('creates temp directory with tokens.json', async () => {
    testEnv = await createTestEnv();

    // Check that temp directory exists
    expect(existsSync(testEnv.workbenchHome)).toBe(true);

    // Check that tokens.json exists
    const tokensPath = path.join(testEnv.workbenchHome, 'tokens.json');
    expect(existsSync(tokensPath)).toBe(true);

    // Verify token file content
    const tokensContent = await readFile(tokensPath, 'utf-8');
    const tokens = JSON.parse(tokensContent);
    
    expect(tokens).toHaveProperty('anthropic');
    expect(tokens.anthropic).toHaveProperty('type', 'oauth');
    expect(tokens.anthropic).toHaveProperty('access');
    expect(tokens.anthropic).toHaveProperty('refresh');
    expect(tokens.anthropic).toHaveProperty('expires');
    expect(tokens.anthropic.access).toMatch(/^sk-ant-oat01-/);
  });

  it('creates sessions subdirectory', async () => {
    testEnv = await createTestEnv();

    const sessionsPath = path.join(testEnv.workbenchHome, 'sessions');
    expect(existsSync(sessionsPath)).toBe(true);
  });

  it('cleanup() removes temp directory', async () => {
    testEnv = await createTestEnv();
    const tempPath = testEnv.workbenchHome;

    // Verify directory exists before cleanup
    expect(existsSync(tempPath)).toBe(true);

    // Cleanup
    await testEnv.cleanup();

    // Verify directory is gone
    expect(existsSync(tempPath)).toBe(false);
    
    // Prevent double cleanup in afterEach
    testEnv = null;
  });

  it('sets WORKBENCH_HOME env var correctly', async () => {
    testEnv = await createTestEnv();

    expect(testEnv.env).toHaveProperty('WORKBENCH_HOME');
    expect(testEnv.env.WORKBENCH_HOME).toBe(testEnv.workbenchHome);
  });

  it('does not set ANTHROPIC_API_URL by default', async () => {
    testEnv = await createTestEnv();

    expect(testEnv.env).not.toHaveProperty('ANTHROPIC_API_URL');
  });

  it('passes through anthropicApiUrl when provided', async () => {
    const mockApiUrl = 'http://localhost:8080/v1/messages';
    testEnv = await createTestEnv({ anthropicApiUrl: mockApiUrl });

    expect(testEnv.env).toHaveProperty('ANTHROPIC_API_URL', mockApiUrl);
  });

  it('accepts custom tokens', async () => {
    const customTokens = {
      anthropic: {
        type: 'oauth',
        access: 'custom-access-token',
        refresh: 'custom-refresh-token',
        expires: 9999999999999,
      },
    };

    testEnv = await createTestEnv({ tokens: customTokens });

    // Read and verify custom tokens
    const tokensPath = path.join(testEnv.workbenchHome, 'tokens.json');
    const tokensContent = await readFile(tokensPath, 'utf-8');
    const tokens = JSON.parse(tokensContent);

    expect(tokens.anthropic.access).toBe('custom-access-token');
    expect(tokens.anthropic.refresh).toBe('custom-refresh-token');
    expect(tokens.anthropic.expires).toBe(9999999999999);
  });

  it('creates agent.json when agentConfig is provided', async () => {
    const customConfig = {
      model: 'claude-test-model',
      systemPrompt: 'Test prompt',
      maxSteps: 10,
      tools: ['tool1', 'tool2'],
    };

    testEnv = await createTestEnv({ agentConfig: customConfig });

    // Check that agent.json exists
    const configPath = path.join(testEnv.workbenchHome, 'agent.json');
    expect(existsSync(configPath)).toBe(true);

    // Verify config content
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    expect(config).toEqual(customConfig);
  });

  it('does not create agent.json when agentConfig is not provided', async () => {
    testEnv = await createTestEnv();

    const configPath = path.join(testEnv.workbenchHome, 'agent.json');
    expect(existsSync(configPath)).toBe(false);
  });

  it('does not interfere with real ~/.workbench/', async () => {
    testEnv = await createTestEnv();

    // Verify that workbenchHome is NOT in the user's home directory
    expect(testEnv.workbenchHome).not.toMatch(/\.workbench/);
    expect(testEnv.workbenchHome).toMatch(/workbench-test-/);
    
    // Verify it's in a temp directory
    expect(testEnv.workbenchHome).toContain('tmp');
  });
});
