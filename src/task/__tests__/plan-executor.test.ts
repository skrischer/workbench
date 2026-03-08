// src/task/__tests__/plan-executor.test.ts — PlanExecutor Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TypedEventBus } from '../../events/event-bus.js';
import type { EventMap } from '../../types/events.js';
import type { Plan, Step, StepResult } from '../../types/task.js';
import type { PlanStorage } from '../plan-storage.js';
import { PlanExecutor, type StepRunner } from '../plan-executor.js';

describe('PlanExecutor', () => {
  let mockStorage: PlanStorage;
  let eventBus: TypedEventBus<EventMap>;
  let mockStepRunner: StepRunner;
  let executor: PlanExecutor;
  let testPlan: Plan;

  beforeEach(() => {
    // Create mock storage
    mockStorage = {
      load: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      updateStepStatus: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    } as unknown as PlanStorage;

    // Create real event bus
    eventBus = new TypedEventBus<EventMap>();

    // Create mock step runner
    mockStepRunner = vi.fn();

    // Create executor
    executor = new PlanExecutor({
      planStorage: mockStorage,
      eventBus,
      stepRunner: mockStepRunner,
    });

    // Create test plan
    testPlan = createTestPlan();
  });

  it('should execute a plan from beginning to end', async () => {
    // Setup
    vi.mocked(mockStorage.load).mockResolvedValue(testPlan);
    vi.mocked(mockStepRunner).mockResolvedValue(createSuccessResult());

    // Track events
    const events: string[] = [];
    eventBus.on('plan:start', () => events.push('plan:start'));
    eventBus.on('plan:step:start', () => events.push('plan:step:start'));
    eventBus.on('plan:step:end', () => events.push('plan:step:end'));
    eventBus.on('plan:end', () => events.push('plan:end'));

    // Execute
    await executor.execute('test-plan');

    // Verify
    expect(mockStepRunner).toHaveBeenCalledTimes(3);
    expect(mockStorage.save).toHaveBeenCalled();
    expect(events).toEqual([
      'plan:start',
      'plan:step:start',
      'plan:step:end',
      'plan:step:start',
      'plan:step:end',
      'plan:step:start',
      'plan:step:end',
      'plan:end',
    ]);

    // Verify final plan state
    const savedPlan = vi.mocked(mockStorage.save).mock.calls.slice(-1)[0][0];
    expect(savedPlan.status).toBe('completed');
    expect(savedPlan.currentStepIndex).toBe(3);
    expect(savedPlan.metadata.totalTokenUsage).toBeDefined();
  });

  it('should resume a paused plan from current step index', async () => {
    // Setup - plan is paused at step 1
    testPlan.status = 'paused';
    testPlan.currentStepIndex = 1;
    testPlan.steps[0].status = 'completed';
    testPlan.steps[0].result = createSuccessResult();

    vi.mocked(mockStorage.load).mockResolvedValue(testPlan);
    vi.mocked(mockStepRunner).mockResolvedValue(createSuccessResult());

    // Execute
    await executor.resume('test-plan');

    // Verify - should only run steps 1 and 2
    expect(mockStepRunner).toHaveBeenCalledTimes(2);
    expect(mockStepRunner).toHaveBeenCalledWith(testPlan.steps[1]);
    expect(mockStepRunner).toHaveBeenCalledWith(testPlan.steps[2]);

    // Verify final plan state
    const savedPlan = vi.mocked(mockStorage.save).mock.calls.slice(-1)[0][0];
    expect(savedPlan.status).toBe('completed');
    expect(savedPlan.currentStepIndex).toBe(3);
  });

  it('should pause execution after current step completes', async () => {
    // Setup
    vi.mocked(mockStorage.load).mockResolvedValue(testPlan);
    
    // Pause after first step
    vi.mocked(mockStepRunner).mockImplementation(async (step) => {
      if (step.id === 'step-1') {
        executor.pause();
      }
      return createSuccessResult();
    });

    // Execute
    await executor.execute('test-plan');

    // Verify - should only run first step
    expect(mockStepRunner).toHaveBeenCalledTimes(1);

    // Verify final plan state
    const savedPlan = vi.mocked(mockStorage.save).mock.calls.slice(-1)[0][0];
    expect(savedPlan.status).toBe('paused');
    expect(savedPlan.currentStepIndex).toBe(1);
  });

  it('should handle step failures correctly', async () => {
    // Setup
    vi.mocked(mockStorage.load).mockResolvedValue(testPlan);
    
    // First step succeeds, second fails
    vi.mocked(mockStepRunner)
      .mockResolvedValueOnce(createSuccessResult())
      .mockResolvedValueOnce(createFailureResult('Step failed'));

    // Track events
    const planEndEvents: Array<{ planId: string; status: string; completedSteps: number }> = [];
    eventBus.on('plan:end', (payload) => planEndEvents.push(payload));

    // Execute
    await executor.execute('test-plan');

    // Verify - should stop after second step
    expect(mockStepRunner).toHaveBeenCalledTimes(2);

    // Verify final plan state
    const savedPlan = vi.mocked(mockStorage.save).mock.calls.slice(-1)[0][0];
    expect(savedPlan.status).toBe('failed');
    expect(savedPlan.currentStepIndex).toBe(1);
    expect(savedPlan.steps[1].status).toBe('failed');
    expect(savedPlan.steps[1].result?.error).toBe('Step failed');

    // Verify plan:end event
    expect(planEndEvents).toHaveLength(1);
    expect(planEndEvents[0].status).toBe('failed');
    expect(planEndEvents[0].completedSteps).toBe(1);
  });

  it('should emit correct events during execution', async () => {
    // Setup
    vi.mocked(mockStorage.load).mockResolvedValue(testPlan);
    vi.mocked(mockStepRunner).mockResolvedValue(createSuccessResult());

    // Track events
    const planStartEvents: Array<{ planId: string; title: string; stepCount: number }> = [];
    const stepStartEvents: Array<{ planId: string; stepId: string; stepIndex: number }> = [];
    const stepEndEvents: Array<{ planId: string; stepId: string; status: string }> = [];
    const planEndEvents: Array<{ planId: string; status: string; totalSteps: number }> = [];

    eventBus.on('plan:start', (payload) => planStartEvents.push(payload));
    eventBus.on('plan:step:start', (payload) => stepStartEvents.push(payload));
    eventBus.on('plan:step:end', (payload) => stepEndEvents.push(payload));
    eventBus.on('plan:end', (payload) => planEndEvents.push(payload));

    // Execute
    await executor.execute('test-plan');

    // Verify plan:start
    expect(planStartEvents).toHaveLength(1);
    expect(planStartEvents[0]).toMatchObject({
      planId: 'test-plan',
      title: 'Test Plan',
      stepCount: 3,
    });

    // Verify step:start events
    expect(stepStartEvents).toHaveLength(3);
    expect(stepStartEvents[0].stepIndex).toBe(0);
    expect(stepStartEvents[1].stepIndex).toBe(1);
    expect(stepStartEvents[2].stepIndex).toBe(2);

    // Verify step:end events
    expect(stepEndEvents).toHaveLength(3);
    expect(stepEndEvents[0].status).toBe('completed');
    expect(stepEndEvents[0].stepId).toBe('step-1');

    // Verify plan:end
    expect(planEndEvents).toHaveLength(1);
    expect(planEndEvents[0]).toMatchObject({
      planId: 'test-plan',
      status: 'completed',
      totalSteps: 3,
      completedSteps: 3,
    });
  });

  it('should accumulate token usage correctly', async () => {
    // Setup
    vi.mocked(mockStorage.load).mockResolvedValue(testPlan);
    
    // Each step has different token usage
    vi.mocked(mockStepRunner)
      .mockResolvedValueOnce(createSuccessResult(100, 50))
      .mockResolvedValueOnce(createSuccessResult(200, 75))
      .mockResolvedValueOnce(createSuccessResult(150, 60));

    // Execute
    await executor.execute('test-plan');

    // Verify final plan state
    const savedPlan = vi.mocked(mockStorage.save).mock.calls.slice(-1)[0][0];
    expect(savedPlan.metadata.totalTokenUsage).toEqual({
      totalInputTokens: 450,
      totalOutputTokens: 185,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: 635,
      stepCount: 3,
    });
  });

  it('should throw error when executing already running plan', async () => {
    // Setup - plan is already running
    testPlan.status = 'running';
    vi.mocked(mockStorage.load).mockResolvedValue(testPlan);

    // Execute & Verify
    await expect(executor.execute('test-plan')).rejects.toThrow('already running');
  });

  it('should throw error when executing completed plan', async () => {
    // Setup - plan is completed
    testPlan.status = 'completed';
    vi.mocked(mockStorage.load).mockResolvedValue(testPlan);

    // Execute & Verify
    await expect(executor.execute('test-plan')).rejects.toThrow('already completed');
  });

  it('should handle unexpected errors during step execution', async () => {
    // Setup
    vi.mocked(mockStorage.load).mockResolvedValue(testPlan);
    
    // First step throws unexpected error
    vi.mocked(mockStepRunner).mockRejectedValueOnce(new Error('Unexpected error'));

    // Execute
    await executor.execute('test-plan');

    // Verify
    const savedPlan = vi.mocked(mockStorage.save).mock.calls.slice(-1)[0][0];
    expect(savedPlan.status).toBe('failed');
    expect(savedPlan.steps[0].status).toBe('failed');
    expect(savedPlan.steps[0].result?.error).toBe('Unexpected error');
  });

  it('should persist plan after each step for crash recovery', async () => {
    // Setup
    vi.mocked(mockStorage.load).mockResolvedValue(testPlan);
    vi.mocked(mockStepRunner).mockResolvedValue(createSuccessResult());

    // Track saved plans by creating snapshots
    const savedSnapshots: Array<{ status: string; currentStepIndex: number }> = [];
    vi.mocked(mockStorage.save).mockImplementation(async (plan) => {
      // Create snapshot of current state
      savedSnapshots.push({
        status: plan.status,
        currentStepIndex: plan.currentStepIndex,
      });
    });

    // Execute
    await executor.execute('test-plan');

    // Verify save was called multiple times
    expect(savedSnapshots.length).toBeGreaterThan(3);
    
    // Verify initial state
    expect(savedSnapshots[0]).toMatchObject({
      status: 'running',
      currentStepIndex: 0,
    });
    
    // Verify final state
    const finalSnapshot = savedSnapshots[savedSnapshots.length - 1];
    expect(finalSnapshot).toMatchObject({
      status: 'completed',
      currentStepIndex: 3,
    });
  });
});

// Helper functions

function createTestPlan(): Plan {
  return {
    id: 'test-plan',
    title: 'Test Plan',
    description: 'A test plan',
    status: 'pending',
    steps: [
      createTestStep('step-1', 'Step 1'),
      createTestStep('step-2', 'Step 2'),
      createTestStep('step-3', 'Step 3'),
    ],
    currentStepIndex: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      originalPrompt: 'Test prompt',
      model: 'test-model',
    },
  };
}

function createTestStep(id: string, title: string): Step {
  return {
    id,
    title,
    prompt: `Prompt for ${title}`,
    status: 'pending',
  };
}

function createSuccessResult(
  inputTokens = 100,
  outputTokens = 50
): StepResult {
  return {
    output: 'Success',
    tokenUsage: {
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: inputTokens + outputTokens,
      stepCount: 1,
    },
    filesModified: [],
    durationMs: 1000,
  };
}

function createFailureResult(error: string): StepResult {
  return {
    output: '',
    tokenUsage: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: 0,
      stepCount: 0,
    },
    filesModified: [],
    durationMs: 500,
    error,
  };
}
