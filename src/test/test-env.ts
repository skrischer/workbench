// src/test/test-env.ts — Isolated test environment helper

import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface TestEnv {
  /** Path to temporary workbench home directory */
  workbenchHome: string;
  /** Environment variables to pass to CLI runner */
  env: Record<string, string>;
  /** Clean up temporary directory */
  cleanup: () => Promise<void>;
}

export interface TestEnvOptions {
  /** URL of mock Anthropic server */
  anthropicApiUrl?: string;
  /** Custom tokens (default: valid test tokens) */
  tokens?: Record<string, unknown>;
  /** Custom agent config */
  agentConfig?: Record<string, unknown>;
}

/**
 * Create an isolated test environment with temporary directories,
 * token files, and agent config.
 * 
 * This helper sets up:
 * - A temporary WORKBENCH_HOME directory
 * - tokens.json with test OAuth tokens
 * - sessions/ subdirectory for session storage
 * - Optional agent.json config file
 * - Environment variables for WORKBENCH_HOME and ANTHROPIC_API_URL
 * 
 * @param options - Configuration options for the test environment
 * @returns TestEnv object with workbenchHome, env vars, and cleanup function
 * 
 * @example
 * ```typescript
 * const testEnv = await createTestEnv({
 *   anthropicApiUrl: 'http://localhost:8080',
 *   agentConfig: { model: 'claude-test', maxSteps: 10 }
 * });
 * 
 * // Use testEnv.env in your tests
 * // ...
 * 
 * // Clean up when done
 * await testEnv.cleanup();
 * ```
 */
export async function createTestEnv(options: TestEnvOptions = {}): Promise<TestEnv> {
  const workbenchHome = await mkdtemp(path.join(tmpdir(), 'workbench-test-'));
  
  // Create subdirectories
  await mkdir(path.join(workbenchHome, 'sessions'), { recursive: true });
  
  // Write tokens in the correct TokenFile format
  const tokens = options.tokens ?? {
    anthropic: {
      type: 'oauth',
      access: 'sk-ant-oat01-test-token-for-e2e-testing',
      refresh: 'sk-ant-ort01-test-refresh-token',
      expires: Date.now() + 3600000, // 1 hour from now
    },
  };
  await writeFile(
    path.join(workbenchHome, 'tokens.json'),
    JSON.stringify(tokens, null, 2),
    'utf-8'
  );
  
  // Write agent config if provided
  if (options.agentConfig) {
    await writeFile(
      path.join(workbenchHome, 'agent.json'),
      JSON.stringify(options.agentConfig, null, 2),
      'utf-8'
    );
  }
  
  // Build env vars
  const env: Record<string, string> = {
    WORKBENCH_HOME: workbenchHome,
    // Point gateway URL to unreachable address so E2E tests use local fallback
    // instead of connecting to a running gateway on the default port
    WORKBENCH_GATEWAY_URL: 'ws://127.0.0.1:1/ws',
  };
  if (options.anthropicApiUrl) {
    env.ANTHROPIC_API_URL = options.anthropicApiUrl;
  }
  
  return {
    workbenchHome,
    env,
    cleanup: async () => {
      await rm(workbenchHome, { recursive: true, force: true });
    },
  };
}
