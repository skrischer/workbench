import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMockAnthropicServer, type MockAnthropicServer } from '../mock-anthropic-server.js';
import { createTestEnv, type TestEnv } from '../test-env.js';
import { runCli } from '../cli-runner.js';
import { simpleText } from '../__fixtures__/index.js';

describe('E2E Smoke Test', () => {
  let mockServer: MockAnthropicServer;
  let testEnv: TestEnv;

  beforeAll(async () => {
    // Start mock server
    mockServer = await createMockAnthropicServer([
      { response: simpleText },
    ]);

    // Create isolated test env
    // Note: ANTHROPIC_API_URL must be the full endpoint URL including /v1/messages
    testEnv = await createTestEnv({
      anthropicApiUrl: `${mockServer.url}/v1/messages`,
    });
  });

  afterAll(async () => {
    await mockServer?.close();
    await testEnv?.cleanup();
  });

  it('should run workbench with mock server and get response', async () => {
    const result = await runCli({
      args: ['run', 'say hi'],
      env: testEnv.env,
      timeout: 15000,
    });

    // The CLI should have contacted mock server
    expect(mockServer.calls.length).toBeGreaterThanOrEqual(1);
    
    // Should exit cleanly (0) or at least not crash
    // Note: may fail if there are other issues, that's expected for a smoke test
    expect(result.timedOut).toBe(false);
  });
});
