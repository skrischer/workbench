// src/multi-agent/__tests__/orchestrator.test.ts — AgentOrchestrator Tests

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentRegistry } from '../agent-registry.js';
import { MessageBus } from '../message-bus.js';
import { AgentOrchestrator } from '../orchestrator.js';
import type { Plan, Step, StepResult } from '../../types/task.js';
import type { AgentMessage } from '../../types/agent.js';
import type { AnthropicClient } from '../../llm/anthropic-client.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { ToolRegistry } from '../../tools/registry.js';

describe('AgentOrchestrator', () => {
  let registry: AgentRegistry;
  let messageBus: MessageBus;
  let orchestrator: AgentOrchestrator;
  let mockClient: AnthropicClient;
  let mockStorage: SessionStorage;
  let mockTools: ToolRegistry;

  beforeEach(() => {
    registry = new AgentRegistry(10);
    messageBus = new MessageBus();
    
    // Create minimal mocks for required dependencies
    mockClient = {} as AnthropicClient;
    mockStorage = {} as SessionStorage;
    mockTools = {} as ToolRegistry;
    
    orchestrator = new AgentOrchestrator(
      registry,
      messageBus,
      mockClient,
      mockStorage,
      mockTools
    );
  });

  afterEach(() => {
    // Cleanup
    registry.clear();
  });

  it('should execute a simple plan with sequential steps', async () => {
    // Create plan with 3 sequential steps
    const plan = createTestPlan([
      createTestStep('step-1', 'Step 1'),
      createTestStep('step-2', 'Step 2'),
      createTestStep('step-3', 'Step 3'),
    ]);

    // Mock worker responses
    mockWorkerResponses(messageBus, {
      'step-1': createSuccessResult('Step 1 completed'),
      'step-2': createSuccessResult('Step 2 completed'),
      'step-3': createSuccessResult('Step 3 completed'),
    });

    // Execute
    const result = await orchestrator.executePlan(plan);

    // Verify
    expect(result.status).toBe('completed');
    expect(result.completedSteps).toBe(3);
    expect(result.totalSteps).toBe(3);
    expect(result.errors).toHaveLength(0);
    expect(result.results.size).toBe(3);

    // Verify all steps completed
    expect(plan.steps[0].status).toBe('completed');
    expect(plan.steps[1].status).toBe('completed');
    expect(plan.steps[2].status).toBe('completed');

    // Verify workers were cleaned up
    expect(registry.count).toBe(0);
  });

  it('should execute parallel steps concurrently', async () => {
    // Create plan with parallel steps (no dependencies)
    const plan = createTestPlan([
      createTestStep('step-1', 'Step 1'),
      createTestStep('step-2', 'Step 2'),
      createTestStep('step-3', 'Step 3'),
    ]);

    // Track execution order
    const executionOrder: string[] = [];

    // Spy on send to track task assignments
    const originalSend = messageBus.send.bind(messageBus);
    vi.spyOn(messageBus, 'send').mockImplementation((from, to, type, payload) => {
      const message = originalSend(from, to, type, payload);

      if (from === 'orchestrator' && type === 'task') {
        const taskPayload = payload as { stepId: string };
        executionOrder.push(`started:${taskPayload.stepId}`);

        // Simulate async work and send response
        setTimeout(() => {
          originalSend(to, 'orchestrator', 'result', {
            stepId: taskPayload.stepId,
            result: createSuccessResult(`${taskPayload.stepId} completed`),
          });
        }, 10);
      }

      return message;
    });

    // Execute
    const result = await orchestrator.executePlan(plan, { maxWorkers: 3 });

    // Verify all steps started (parallel execution)
    expect(executionOrder).toContain('started:step-1');
    expect(executionOrder).toContain('started:step-2');
    expect(executionOrder).toContain('started:step-3');

    // Verify completion
    expect(result.status).toBe('completed');
    expect(result.completedSteps).toBe(3);
  });

  it('should respect step dependencies and execute in correct order', async () => {
    // Create plan with dependencies:
    // step-1 (no deps)
    // step-2 (depends on step-1)
    // step-3 (depends on step-2)
    const plan = createTestPlan([
      createTestStep('step-1', 'Step 1'),
      createTestStep('step-2', 'Step 2', ['step-1']),
      createTestStep('step-3', 'Step 3', ['step-2']),
    ]);

    const executionOrder: string[] = [];

    // Spy on send to track task assignments
    const originalSend = messageBus.send.bind(messageBus);
    vi.spyOn(messageBus, 'send').mockImplementation((from, to, type, payload) => {
      const message = originalSend(from, to, type, payload);

      if (from === 'orchestrator' && type === 'task') {
        const taskPayload = payload as { stepId: string };
        executionOrder.push(taskPayload.stepId);

        // Send immediate response
        setTimeout(() => {
          originalSend(to, 'orchestrator', 'result', {
            stepId: taskPayload.stepId,
            result: createSuccessResult(`${taskPayload.stepId} completed`),
          });
        }, 1);
      }

      return message;
    });

    // Execute
    const result = await orchestrator.executePlan(plan);

    // Verify execution order
    expect(executionOrder).toEqual(['step-1', 'step-2', 'step-3']);
    expect(result.status).toBe('completed');
    expect(result.completedSteps).toBe(3);
  });

  it('should handle step failures and pause execution', async () => {
    // Create plan with 3 sequential steps (with dependencies)
    const plan = createTestPlan([
      createTestStep('step-1', 'Step 1'),
      createTestStep('step-2', 'Step 2', ['step-1']),
      createTestStep('step-3', 'Step 3', ['step-2']),
    ]);

    // Mock worker responses - step 2 fails
    mockWorkerResponses(messageBus, {
      'step-1': createSuccessResult('Step 1 completed'),
      'step-2': { error: 'Step 2 failed' },
      'step-3': createSuccessResult('Step 3 completed'),
    });

    // Execute
    const result = await orchestrator.executePlan(plan);

    // Verify plan paused after failure
    expect(result.status).toBe('paused');
    expect(result.completedSteps).toBe(1); // Only step 1 completed
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].stepId).toBe('step-2');
    expect(result.errors[0].error).toContain('Step 2 failed');

    // Verify step statuses
    expect(plan.steps[0].status).toBe('completed');
    expect(plan.steps[1].status).toBe('failed');
    expect(plan.steps[2].status).toBe('pending'); // step-3 should not have been executed
    
    // Workers should be cleaned up even on failure
    expect(registry.count).toBe(0);
  });

  it('should respect maxWorkers limit', async () => {
    // Create plan with 10 parallel steps
    const steps: Step[] = [];
    for (let i = 1; i <= 10; i++) {
      steps.push(createTestStep(`step-${i}`, `Step ${i}`));
    }
    const plan = createTestPlan(steps);

    // Track number of workers spawned
    let workersSpawned = 0;
    const originalSpawn = registry.spawn.bind(registry);
    vi.spyOn(registry, 'spawn').mockImplementation((config) => {
      workersSpawned++;
      return originalSpawn(config);
    });

    // Mock worker responses
    mockWorkerResponses(
      messageBus,
      Object.fromEntries(
        steps.map((step) => [
          step.id,
          createSuccessResult(`${step.id} completed`),
        ])
      )
    );

    // Execute with maxWorkers = 3
    const result = await orchestrator.executePlan(plan, { maxWorkers: 3 });

    // Verify max workers respected (should spawn exactly 3 workers)
    expect(workersSpawned).toBeLessThanOrEqual(3);
    expect(result.status).toBe('completed');
    expect(result.completedSteps).toBe(10);
  });

  it('should handle empty plan gracefully', async () => {
    // Create empty plan
    const plan = createTestPlan([]);

    // Execute
    const result = await orchestrator.executePlan(plan);

    // Verify
    expect(result.status).toBe('completed');
    expect(result.completedSteps).toBe(0);
    expect(result.totalSteps).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.results.size).toBe(0);
  });

  it('should terminate workers on completion', async () => {
    // Create plan
    const plan = createTestPlan([
      createTestStep('step-1', 'Step 1'),
      createTestStep('step-2', 'Step 2'),
    ]);

    // Mock worker responses
    mockWorkerResponses(messageBus, {
      'step-1': createSuccessResult('Step 1 completed'),
      'step-2': createSuccessResult('Step 2 completed'),
    });

    // Verify registry is empty initially
    expect(registry.count).toBe(0);

    // Execute
    await orchestrator.executePlan(plan);

    // Verify all workers terminated
    expect(registry.count).toBe(0);
  });

  it('should handle step timeout', async () => {
    // Create plan
    const plan = createTestPlan([createTestStep('step-1', 'Step 1')]);

    // Spy on send but don't send responses (simulate timeout)
    const originalSend = messageBus.send.bind(messageBus);
    vi.spyOn(messageBus, 'send').mockImplementation((from, to, type, payload) => {
      const message = originalSend(from, to, type, payload);
      // Don't send any responses - will timeout
      return message;
    });

    // Execute with short timeout
    const result = await orchestrator.executePlan(plan, { stepTimeoutMs: 100 });

    // Verify timeout handled
    expect(result.status).toBe('paused');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('timed out');
  });

  it('should detect circular dependencies', async () => {
    // Create plan with circular dependency
    const plan = createTestPlan([
      createTestStep('step-1', 'Step 1', ['step-2']),
      createTestStep('step-2', 'Step 2', ['step-1']),
    ]);

    // Execute
    const result = await orchestrator.executePlan(plan);

    // Verify error
    expect(result.status).toBe('failed');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].error).toContain('Circular dependency');
  });

  it('should collect results correctly', async () => {
    // Create plan
    const plan = createTestPlan([
      createTestStep('step-1', 'Step 1'),
      createTestStep('step-2', 'Step 2'),
    ]);

    // Mock worker responses with specific data
    mockWorkerResponses(messageBus, {
      'step-1': createSuccessResult('Result 1', 100, 50),
      'step-2': createSuccessResult('Result 2', 200, 75),
    });

    // Execute
    const result = await orchestrator.executePlan(plan);

    // Verify results collected
    expect(result.results.size).toBe(2);
    expect(result.results.get('step-1')?.output).toBe('Result 1');
    expect(result.results.get('step-2')?.output).toBe('Result 2');

    // Verify duration tracked
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('should execute mixed parallel and sequential steps', async () => {
    // Create plan:
    // step-1, step-2 (parallel, no deps)
    // step-3 (depends on step-1, step-2)
    const plan = createTestPlan([
      createTestStep('step-1', 'Step 1'),
      createTestStep('step-2', 'Step 2'),
      createTestStep('step-3', 'Step 3', ['step-1', 'step-2']),
    ]);

    const executionOrder: string[] = [];

    // Spy on send to track task assignments
    const originalSend = messageBus.send.bind(messageBus);
    vi.spyOn(messageBus, 'send').mockImplementation((from, to, type, payload) => {
      const message = originalSend(from, to, type, payload);

      if (from === 'orchestrator' && type === 'task') {
        const taskPayload = payload as { stepId: string };
        executionOrder.push(taskPayload.stepId);

        setTimeout(() => {
          originalSend(to, 'orchestrator', 'result', {
            stepId: taskPayload.stepId,
            result: createSuccessResult(`${taskPayload.stepId} completed`),
          });
        }, 1);
      }

      return message;
    });

    // Execute
    const result = await orchestrator.executePlan(plan);

    // Verify step-1 and step-2 executed before step-3
    const step3Index = executionOrder.indexOf('step-3');
    const step1Index = executionOrder.indexOf('step-1');
    const step2Index = executionOrder.indexOf('step-2');

    expect(step1Index).toBeLessThan(step3Index);
    expect(step2Index).toBeLessThan(step3Index);
    expect(result.status).toBe('completed');
  });
});

// Helper functions

function createTestPlan(steps: Step[]): Plan {
  return {
    id: 'test-plan',
    title: 'Test Plan',
    description: 'A test plan',
    status: 'pending',
    steps,
    currentStepIndex: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      originalPrompt: 'Test prompt',
      model: 'test-model',
    },
  };
}

function createTestStep(
  id: string,
  title: string,
  dependsOn?: string[]
): Step {
  return {
    id,
    title,
    prompt: `Prompt for ${title}`,
    status: 'pending',
    dependsOn,
  };
}

function createSuccessResult(
  output = 'Success',
  inputTokens = 100,
  outputTokens = 50
): StepResult {
  return {
    output,
    tokenUsage: {
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: inputTokens + outputTokens,
      stepCount: 1,
    },
    filesModified: [],
    durationMs: 100,
  };
}

/**
 * Mock worker responses for specific steps.
 * Automatically sends responses when task messages are received.
 */
function mockWorkerResponses(
  messageBus: MessageBus,
  responses: Record<string, StepResult | { error: string }>
): void {
  // Spy on messageBus.send to intercept task messages
  const originalSend = messageBus.send.bind(messageBus);
  vi.spyOn(messageBus, 'send').mockImplementation((from, to, type, payload) => {
    // Call original to maintain message history
    const message = originalSend(from, to, type, payload);

    // If this is a task message from orchestrator to a worker
    if (from === 'orchestrator' && type === 'task') {
      const taskPayload = payload as { stepId: string };
      const response = responses[taskPayload.stepId];

      if (response) {
        // Send response after short delay to simulate async work
        setTimeout(() => {
          if ('error' in response) {
            originalSend(to, 'orchestrator', 'result', {
              stepId: taskPayload.stepId,
              error: response.error,
            });
          } else {
            originalSend(to, 'orchestrator', 'result', {
              stepId: taskPayload.stepId,
              result: response,
            });
          }
        }, 5);
      }
    }

    return message;
  });
}
