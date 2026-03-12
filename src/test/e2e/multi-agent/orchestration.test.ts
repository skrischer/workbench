// src/test/e2e/multi-agent/orchestration.test.ts — E2E Multi-Agent Orchestration Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AgentRegistry } from '../../../multi-agent/agent-registry.js';
import { MessageBus } from '../../../multi-agent/message-bus.js';
import { AgentOrchestrator } from '../../../multi-agent/orchestrator.js';
import { AgentLoop } from '../../../runtime/agent-loop.js';
import { AnthropicClient } from '../../../llm/anthropic-client.js';
import { SessionStorage } from '../../../storage/session-storage.js';
import { ToolRegistry } from '../../../tools/registry.js';
import type { TokenRefresher } from '../../../llm/token-refresh.js';
import type { AgentMessage } from '../../../types/agent.js';
import { createMockAnthropicServer, type MockAnthropicServer } from '../../mock-anthropic-server.js';

describe('E2E Multi-Agent Orchestration', () => {
  let registry: AgentRegistry;
  let messageBus: MessageBus;
  let orchestrator: AgentOrchestrator;
  let anthropicClient: AnthropicClient;
  let sessionStorage: SessionStorage;
  let toolRegistry: ToolRegistry;
  let mockServer: MockAnthropicServer;
  let testDir: string;
  let mockTokenRefresher: TokenRefresher;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(os.tmpdir(), `workbench-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Initialize components
    registry = new AgentRegistry(10);
    messageBus = new MessageBus();
    
    // Setup mock Anthropic server
    mockServer = await createMockAnthropicServer([
      {
        // Response for worker agent task execution
        response: {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Task completed successfully',
            },
          ],
          model: 'claude-sonnet-4',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 10 },
        },
      },
    ]);

    // Create mock TokenRefresher
    mockTokenRefresher = {
      ensureValidToken: vi.fn().mockResolvedValue('test-access-token'),
    } as unknown as TokenRefresher;

    // Create real Anthropic client pointing to mock server
    anthropicClient = new AnthropicClient(mockTokenRefresher, {
      apiUrl: `${mockServer.url}/v1/messages`,
    });

    // Create real session storage
    sessionStorage = new SessionStorage(testDir);

    // Create tool registry
    toolRegistry = new ToolRegistry();

    // Create orchestrator
    orchestrator = new AgentOrchestrator(
      registry,
      messageBus,
      anthropicClient,
      sessionStorage,
      toolRegistry
    );
  });

  afterEach(async () => {
    await mockServer?.close();
    registry.clear();
  });

  it('should spawn worker, execute task, report back, and complete', async () => {
    // 1. Lead spawns Worker
    const leadAgent = registry.spawn({
      role: 'planner',
      name: 'lead-agent',
      model: 'claude-sonnet-4',
    });

    expect(leadAgent).toBeDefined();
    expect(leadAgent.status).toBe('idle');
    expect(registry.get(leadAgent.id)).toBeDefined();

    // 2. Worker is spawned by lead (simulating spawn_agent tool)
    const workerAgent = registry.spawn({
      role: 'worker',
      name: 'worker-agent',
      model: 'claude-sonnet-4',
      parentId: leadAgent.id,
    });

    expect(workerAgent).toBeDefined();
    expect(workerAgent.parentId).toBe(leadAgent.id);
    expect(registry.get(workerAgent.id)).toBeDefined();

    // 3. Track messages from worker to lead
    const messagesReceived: AgentMessage[] = [];
    messageBus.onMessage(leadAgent.id, (message) => {
      messagesReceived.push(message);
    });

    // 4. Worker executes task (simulate by running AgentLoop)
    registry.onStatusChange(workerAgent.id, 'running');

    // Create a simple AgentLoop for the worker
    const workerLoop = new AgentLoop(
      anthropicClient,
      sessionStorage,
      toolRegistry,
      {
        model: 'claude-sonnet-4',
        systemPrompt: 'You are a worker agent that completes tasks.',
        maxSteps: 5,
      },
      undefined, // eventBus
      undefined, // hooks
      workerAgent.id
    );

    // Run the worker with a simple task
    const runResult = await workerLoop.run('Complete a simple task');

    // 5. Worker reports completion via send_message
    const completionMessage = messageBus.send(
      workerAgent.id,
      leadAgent.id,
      'result',
      {
        status: 'completed',
        output: runResult.finalResponse,
      }
    );

    // 6. Update worker status to completed
    registry.onStatusChange(workerAgent.id, 'completed');

    // 7. Verify assertions
    
    // Worker is in registry
    const finalWorker = registry.get(workerAgent.id);
    expect(finalWorker).toBeDefined();
    expect(finalWorker?.status).toBe('completed');

    // Worker completed successfully
    expect(runResult.status).toBe('completed');
    expect(runResult.finalResponse).toBeTruthy();

    // Lead received message from worker
    expect(messagesReceived.length).toBe(1);
    expect(messagesReceived[0].from).toBe(workerAgent.id);
    expect(messagesReceived[0].to).toBe(leadAgent.id);
    expect(messagesReceived[0].type).toBe('result');

    // Verify message payload
    const payload = messagesReceived[0].payload as {
      status: string;
      output: string;
    };
    expect(payload.status).toBe('completed');
    expect(payload.output).toBeTruthy();

    // Verify message history
    const history = messageBus.getHistory(workerAgent.id);
    expect(history.length).toBe(1);
    expect(history[0]).toEqual(completionMessage);
  });

  it('should handle worker failure and error reporting', async () => {
    // 1. Lead spawns Worker
    const leadAgent = registry.spawn({
      role: 'planner',
      name: 'lead-agent',
      model: 'claude-sonnet-4',
    });

    // 2. Worker is spawned
    const workerAgent = registry.spawn({
      role: 'worker',
      name: 'failing-worker',
      model: 'claude-sonnet-4',
      parentId: leadAgent.id,
    });

    // 3. Track error messages
    const errorsReceived: AgentMessage[] = [];
    messageBus.onMessage(leadAgent.id, (message) => {
      if (message.type === 'error') {
        errorsReceived.push(message);
      }
    });

    // 4. Simulate worker failure
    registry.onStatusChange(workerAgent.id, 'running');

    // Worker sends error message
    messageBus.send(workerAgent.id, leadAgent.id, 'error', {
      error: 'Task execution failed',
      details: 'Simulated failure',
    });

    // Update worker status to failed
    registry.onStatusChange(workerAgent.id, 'failed');

    // 5. Verify error handling
    expect(registry.get(workerAgent.id)?.status).toBe('failed');
    expect(errorsReceived.length).toBe(1);
    expect(errorsReceived[0].type).toBe('error');

    const errorPayload = errorsReceived[0].payload as {
      error: string;
      details: string;
    };
    expect(errorPayload.error).toBe('Task execution failed');
  });

  it('should support multiple workers reporting to same lead', async () => {
    // 1. Lead spawns multiple workers
    const leadAgent = registry.spawn({
      role: 'planner',
      name: 'lead-agent',
      model: 'claude-sonnet-4',
    });

    const worker1 = registry.spawn({
      role: 'worker',
      name: 'worker-1',
      model: 'claude-sonnet-4',
      parentId: leadAgent.id,
    });

    const worker2 = registry.spawn({
      role: 'worker',
      name: 'worker-2',
      model: 'claude-sonnet-4',
      parentId: leadAgent.id,
    });

    // 2. Track all messages
    const messagesReceived: AgentMessage[] = [];
    messageBus.onMessage(leadAgent.id, (message) => {
      messagesReceived.push(message);
    });

    // 3. Both workers send completion messages
    messageBus.send(worker1.id, leadAgent.id, 'result', {
      workerId: worker1.id,
      status: 'completed',
    });

    messageBus.send(worker2.id, leadAgent.id, 'result', {
      workerId: worker2.id,
      status: 'completed',
    });

    // 4. Update statuses
    registry.onStatusChange(worker1.id, 'completed');
    registry.onStatusChange(worker2.id, 'completed');

    // 5. Verify both workers reported back
    expect(messagesReceived.length).toBe(2);

    const worker1Message = messagesReceived.find((m) => m.from === worker1.id);
    const worker2Message = messagesReceived.find((m) => m.from === worker2.id);

    expect(worker1Message).toBeDefined();
    expect(worker2Message).toBeDefined();

    // 6. Verify both workers are completed
    expect(registry.get(worker1.id)?.status).toBe('completed');
    expect(registry.get(worker2.id)?.status).toBe('completed');
  });

  it('should queue messages when lead handler is not registered', async () => {
    // 1. Spawn lead and worker
    const leadAgent = registry.spawn({
      role: 'planner',
      name: 'lead-agent',
      model: 'claude-sonnet-4',
    });

    const workerAgent = registry.spawn({
      role: 'worker',
      name: 'worker-agent',
      model: 'claude-sonnet-4',
      parentId: leadAgent.id,
    });

    // 2. Worker sends message BEFORE lead registers handler
    messageBus.send(workerAgent.id, leadAgent.id, 'result', {
      status: 'completed',
      data: 'task output',
    });

    // 3. Verify message is queued
    const queue = messageBus.getQueue(leadAgent.id);
    expect(queue.length).toBe(1);
    expect(queue[0].from).toBe(workerAgent.id);

    // 4. Lead registers handler - should receive queued message
    const receivedMessages: AgentMessage[] = [];
    messageBus.onMessage(leadAgent.id, (message) => {
      receivedMessages.push(message);
    });

    // 5. Verify queued message was delivered
    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0].from).toBe(workerAgent.id);

    // 6. Queue should be empty now
    expect(messageBus.getQueue(leadAgent.id).length).toBe(0);
  });
});
