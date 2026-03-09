// src/workflows/__tests__/chain.test.ts — Tests for WorkflowChain

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WorkflowChain } from '../chain.js';
import { WorkflowRunner } from '../runner.js';
import { WorkflowRegistry } from '../registry.js';
import type {
  WorkflowDefinition,
  WorkflowResult,
  ChainDefinition,
} from '../../types/workflow.js';
import type { AnthropicClient } from '../../llm/anthropic-client.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { ToolRegistry } from '../../tools/registry.js';
import type { TypedEventBus } from '../../events/event-bus.js';

// Mock dependencies
function createMockAnthropicClient(): AnthropicClient {
  return {} as AnthropicClient;
}

function createMockSessionStorage(): SessionStorage {
  return {} as SessionStorage;
}

function createMockToolRegistry(): ToolRegistry {
  return {} as ToolRegistry;
}

function createMockEventBus(): TypedEventBus {
  const listeners = new Map<string, Set<(payload: any) => void>>();
  
  return {
    emit: vi.fn((event: string, payload: any) => {
      const handlers = listeners.get(event);
      if (handlers) {
        handlers.forEach(handler => handler(payload));
      }
    }),
    on: vi.fn((event: string, handler: (payload: any) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
      return () => listeners.get(event)!.delete(handler);
    }),
    once: vi.fn(),
    off: vi.fn(),
    clear: vi.fn(),
    listenerCount: vi.fn(),
  } as unknown as TypedEventBus;
}

// Create a simple workflow definition for testing
function createTestWorkflow(id: string): WorkflowDefinition {
  return {
    id,
    name: `Test Workflow ${id}`,
    description: `Test workflow ${id}`,
    systemPrompt: `You are ${id}`,
    tools: ['read', 'write'],
    defaultMaxSteps: 10,
    inputSchema: {
      required: [],
      optional: ['context'],
    },
    validateInput: () => null,
  };
}

// Helper to create a successful WorkflowResult
function createSuccessResult(workflowId: string, output: string, tokens = 150): WorkflowResult {
  return {
    workflowId,
    status: 'completed',
    output,
    filesModified: [],
    tokenUsage: {
      totalInputTokens: Math.floor(tokens * 0.66),
      totalOutputTokens: Math.floor(tokens * 0.34),
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: tokens,
      stepCount: 1,
    },
    durationMs: 100,
  };
}

// Helper to create a failed WorkflowResult
function createFailedResult(workflowId: string, errorMessage: string): WorkflowResult {
  return {
    workflowId,
    status: 'failed',
    output: errorMessage,
    filesModified: [],
    tokenUsage: {
      totalInputTokens: 50,
      totalOutputTokens: 25,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: 75,
      stepCount: 1,
    },
    durationMs: 50,
  };
}

describe('WorkflowChain', () => {
  let registry: WorkflowRegistry;
  let anthropicClient: AnthropicClient;
  let sessionStorage: SessionStorage;
  let toolRegistry: ToolRegistry;
  let eventBus: TypedEventBus;
  let chain: WorkflowChain;
  let runSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registry = new WorkflowRegistry();
    anthropicClient = createMockAnthropicClient();
    sessionStorage = createMockSessionStorage();
    toolRegistry = createMockToolRegistry();
    eventBus = createMockEventBus();
    
    chain = new WorkflowChain(
      registry,
      anthropicClient,
      sessionStorage,
      toolRegistry,
      eventBus
    );

    // Register test workflows
    registry.register(createTestWorkflow('workflow-1'));
    registry.register(createTestWorkflow('workflow-2'));
    registry.register(createTestWorkflow('workflow-3'));

    // Spy on WorkflowRunner.prototype.run
    runSpy = vi.spyOn(WorkflowRunner.prototype, 'run') as any;
  });

  afterEach(() => {
    runSpy.mockRestore();
  });

  it('should execute a chain with 3 workflows successfully (happy path)', async () => {
    runSpy
      .mockResolvedValueOnce(createSuccessResult('workflow-1', 'Result from workflow 1', 150))
      .mockResolvedValueOnce(createSuccessResult('workflow-2', 'Result from workflow 2', 300))
      .mockResolvedValueOnce(createSuccessResult('workflow-3', 'Result from workflow 3', 225));

    const chainDef: ChainDefinition = {
      steps: [
        { workflowId: 'workflow-1', params: { input: 'test' } },
        { workflowId: 'workflow-2', params: {} },
        { workflowId: 'workflow-3', params: {} },
      ],
    };

    const result = await chain.run(chainDef);

    expect(result.status).toBe('completed');
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('completed');
    expect(result.steps[2].status).toBe('completed');
    expect(result.totalTokenUsage.totalTokens).toBe(675); // 150 + 300 + 225
    expect(result.totalTokenUsage.stepCount).toBe(3);
    expect(runSpy).toHaveBeenCalledTimes(3);
  });

  it('should stop chain when a workflow fails (error stop)', async () => {
    runSpy
      .mockResolvedValueOnce(createSuccessResult('workflow-1', 'Result from workflow 1', 150))
      .mockResolvedValueOnce(createFailedResult('workflow-2', 'Error in workflow 2'));

    const chainDef: ChainDefinition = {
      steps: [
        { workflowId: 'workflow-1', params: {} },
        { workflowId: 'workflow-2', params: {} },
        { workflowId: 'workflow-3', params: {} }, // Should not run
      ],
    };

    const result = await chain.run(chainDef);

    expect(result.status).toBe('partial');
    expect(result.steps).toHaveLength(2); // Only 2 steps executed
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('failed');
    expect(runSpy).toHaveBeenCalledTimes(2); // workflow-3 never called
  });

  it('should skip step when condition.status does not match (conditional skip - status)', async () => {
    runSpy
      .mockResolvedValueOnce(createSuccessResult('workflow-1', 'Success', 150))
      .mockResolvedValueOnce(createSuccessResult('workflow-3', 'Final result', 75));

    const chainDef: ChainDefinition = {
      steps: [
        { workflowId: 'workflow-1', params: {} },
        {
          workflowId: 'workflow-2',
          params: {},
          condition: { status: 'failed' }, // Skip because workflow-1 was 'completed'
        },
        { workflowId: 'workflow-3', params: {} },
      ],
    };

    const result = await chain.run(chainDef);

    expect(result.status).toBe('completed');
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('skipped');
    expect(result.steps[1].skipReason).toContain("status was 'completed'");
    expect(result.steps[2].status).toBe('completed');
    expect(runSpy).toHaveBeenCalledTimes(2); // workflow-2 skipped
  });

  it('should skip step when tokenUsage.$lt condition not met (conditional skip - tokenUsage $lt)', async () => {
    runSpy.mockResolvedValueOnce(createSuccessResult('workflow-1', 'Large output', 1000));

    const chainDef: ChainDefinition = {
      steps: [
        { workflowId: 'workflow-1', params: {} },
        {
          workflowId: 'workflow-2',
          params: {},
          condition: { tokenUsage: { $lt: 500 } }, // Skip because 1000 >= 500
        },
      ],
    };

    const result = await chain.run(chainDef);

    expect(result.status).toBe('completed');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('skipped');
    expect(result.steps[1].skipReason).toContain('tokenUsage was 1000');
    expect(result.steps[1].skipReason).toContain('expected < 500');
  });

  it('should skip step when tokenUsage.$gt condition not met (conditional skip - tokenUsage $gt)', async () => {
    runSpy.mockResolvedValueOnce(createSuccessResult('workflow-1', 'Small output', 100));

    const chainDef: ChainDefinition = {
      steps: [
        { workflowId: 'workflow-1', params: {} },
        {
          workflowId: 'workflow-2',
          params: {},
          condition: { tokenUsage: { $gt: 500 } }, // Skip because 100 <= 500
        },
      ],
    };

    const result = await chain.run(chainDef);

    expect(result.status).toBe('completed');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('skipped');
    expect(result.steps[1].skipReason).toContain('tokenUsage was 100');
    expect(result.steps[1].skipReason).toContain('expected > 500');
  });

  it('should skip step when outputContains condition not met (conditional skip - outputContains)', async () => {
    runSpy.mockResolvedValueOnce(createSuccessResult('workflow-1', 'No special marker here', 150));

    const chainDef: ChainDefinition = {
      steps: [
        { workflowId: 'workflow-1', params: {} },
        {
          workflowId: 'workflow-2',
          params: {},
          condition: { outputContains: 'SPECIAL_MARKER' }, // Skip because output doesn't contain it
        },
      ],
    };

    const result = await chain.run(chainDef);

    expect(result.status).toBe('completed');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('skipped');
    expect(result.steps[1].skipReason).toContain("output did not contain 'SPECIAL_MARKER'");
  });

  it('should forward output as context parameter (output forwarding)', async () => {
    runSpy
      .mockResolvedValueOnce(createSuccessResult('workflow-1', 'First workflow output', 150))
      .mockResolvedValueOnce(createSuccessResult('workflow-2', 'Second workflow output', 300));

    const chainDef: ChainDefinition = {
      steps: [
        { workflowId: 'workflow-1', params: { input: 'initial' } },
        { workflowId: 'workflow-2', params: { someParam: 'value' } },
      ],
    };

    const result = await chain.run(chainDef);

    expect(result.status).toBe('completed');
    
    // Check that second workflow received context from first
    expect(runSpy).toHaveBeenNthCalledWith(1, { input: 'initial' });
    expect(runSpy).toHaveBeenNthCalledWith(2, {
      someParam: 'value',
      context: 'First workflow output',
    });
  });

  it('should emit workflow:chain:start and workflow:chain:end events', async () => {
    runSpy.mockResolvedValue(createSuccessResult('workflow-1', 'Done', 150));

    const chainDef: ChainDefinition = {
      steps: [{ workflowId: 'workflow-1', params: {} }],
    };

    await chain.run(chainDef);

    // Check events emitted
    expect(eventBus.emit).toHaveBeenCalledWith('workflow:chain:start', {
      stepCount: 1,
    });
    expect(eventBus.emit).toHaveBeenCalledWith('workflow:chain:end', expect.objectContaining({
      status: 'completed',
      durationMs: expect.any(Number),
    }));
  });

  it('should serialize and deserialize conditions (condition serialization roundtrip)', () => {
    const condition = {
      status: 'completed' as const,
      tokenUsage: { $lt: 1000, $gt: 100 },
      outputContains: 'success',
    };

    // Serialize to JSON
    const json = JSON.stringify(condition);
    
    // Deserialize from JSON
    const parsed = JSON.parse(json);

    // Should match original
    expect(parsed).toEqual(condition);
    expect(parsed.status).toBe('completed');
    expect(parsed.tokenUsage.$lt).toBe(1000);
    expect(parsed.tokenUsage.$gt).toBe(100);
    expect(parsed.outputContains).toBe('success');
  });

  it('should fail when workflow is not found in registry', async () => {
    const chainDef: ChainDefinition = {
      steps: [
        { workflowId: 'non-existent-workflow', params: {} },
      ],
    };

    const result = await chain.run(chainDef);

    expect(result.status).toBe('failed');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].status).toBe('failed');
    expect(result.steps[0].output).toContain("Workflow 'non-existent-workflow' not found");
  });

  it('should handle runner throwing unexpected errors', async () => {
    runSpy.mockRejectedValue(new Error('Unexpected error in runner'));

    const chainDef: ChainDefinition = {
      steps: [
        { workflowId: 'workflow-1', params: {} },
      ],
    };

    const result = await chain.run(chainDef);

    expect(result.status).toBe('failed');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].status).toBe('failed');
    expect(result.steps[0].output).toContain('Unexpected error in runner');
  });
});
