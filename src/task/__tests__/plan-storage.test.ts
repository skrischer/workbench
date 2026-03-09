// src/task/__tests__/plan-storage.test.ts — Tests for PlanStorage

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { PlanStorage } from '../plan-storage.js';
import type { Plan, Step } from '../../types/task.js';

describe('PlanStorage', () => {
  let tempDir: string;
  let storage: PlanStorage;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'plan-storage-test-'));
    storage = new PlanStorage(tempDir);
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  const createTestPlan = (id: string = 'test-plan-1'): Plan => {
    const step: Step = {
      id: 'step-1',
      title: 'Test Step',
      prompt: 'Do something',
      status: 'pending',
    };

    return {
      id,
      title: 'Test Plan',
      description: 'A test plan',
      status: 'pending',
      steps: [step],
      currentStepIndex: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        originalPrompt: 'Original test prompt',
        model: 'test-model',
      },
    };
  };

  it('should create and load a plan (CRUD roundtrip)', async () => {
    const plan = createTestPlan();

    // Create plan
    await storage.create(plan);

    // Verify directory exists
    const planDir = join(tempDir, plan.id);
    expect(existsSync(planDir)).toBe(true);

    // Load plan back
    const loaded = await storage.load(plan.id);
    expect(loaded.id).toBe(plan.id);
    expect(loaded.title).toBe(plan.title);
    expect(loaded.description).toBe(plan.description);
    expect(loaded.steps.length).toBe(1);
    expect(loaded.steps[0].id).toBe('step-1');
  });

  it('should throw error when creating a plan that already exists', async () => {
    const plan = createTestPlan();
    await storage.create(plan);

    // Try to create again
    await expect(storage.create(plan)).rejects.toThrow('Plan already exists');
  });

  it('should save a plan atomically', async () => {
    const plan = createTestPlan();
    await storage.create(plan);

    // Wait to ensure updatedAt differs from createdAt
    await new Promise(r => setTimeout(r, 10));

    // Modify and save
    plan.title = 'Updated Title';
    plan.status = 'running';
    await storage.save(plan);

    // Load and verify
    const loaded = await storage.load(plan.id);
    expect(loaded.title).toBe('Updated Title');
    expect(loaded.status).toBe('running');
    // updatedAt should have been updated
    expect(loaded.updatedAt).not.toBe(plan.createdAt);
  });

  it('should update step status', async () => {
    const plan = createTestPlan();
    await storage.create(plan);

    // Update step status
    await storage.updateStepStatus(plan.id, 'step-1', 'running');

    // Load and verify
    const loaded = await storage.load(plan.id);
    expect(loaded.steps[0].status).toBe('running');
  });

  it('should update step status with result', async () => {
    const plan = createTestPlan();
    await storage.create(plan);

    // Update step with result
    const result = {
      output: 'Step completed successfully',
      tokenUsage: {
        totalInputTokens: 100,
        totalOutputTokens: 50,
        totalCacheReadTokens: 0,
        totalCacheWriteTokens: 0,
        totalTokens: 150,
        stepCount: 1,
      },
      filesModified: ['test.ts'],
      durationMs: 1500,
    };

    await storage.updateStepStatus(plan.id, 'step-1', 'completed', result);

    // Load and verify
    const loaded = await storage.load(plan.id);
    expect(loaded.steps[0].status).toBe('completed');
    expect(loaded.steps[0].result).toEqual(result);
  });

  it('should list plans with metadata (without full steps)', async () => {
    const plan1 = createTestPlan('plan-1');
    const plan2 = createTestPlan('plan-2');
    plan2.title = 'Second Plan';
    plan2.steps.push({
      id: 'step-2',
      title: 'Another Step',
      prompt: 'Do more',
      status: 'pending',
    });

    await storage.create(plan1);
    await storage.create(plan2);

    // List plans
    const result = await storage.list();
    const list = result.data;
    expect(list.length).toBe(2);
    expect(result.total).toBe(2);

    // Verify metadata
    const listed1 = list.find((p) => p.id === 'plan-1');
    const listed2 = list.find((p) => p.id === 'plan-2');

    expect(listed1).toBeDefined();
    expect(listed1!.title).toBe('Test Plan');
    expect(listed1!.stepCount).toBe(1);

    expect(listed2).toBeDefined();
    expect(listed2!.title).toBe('Second Plan');
    expect(listed2!.stepCount).toBe(2);
  });

  it('should delete a plan', async () => {
    const plan = createTestPlan();
    await storage.create(plan);

    // Verify it exists
    const planDir = join(tempDir, plan.id);
    expect(existsSync(planDir)).toBe(true);

    // Delete it
    await storage.delete(plan.id);

    // Verify it's gone
    expect(existsSync(planDir)).toBe(false);

    // Loading should fail
    await expect(storage.load(plan.id)).rejects.toThrow('Plan not found');
  });

  it('should throw error when loading non-existent plan', async () => {
    await expect(storage.load('non-existent')).rejects.toThrow('Plan not found');
  });

  it('should throw error when updating step in non-existent plan', async () => {
    await expect(
      storage.updateStepStatus('non-existent', 'step-1', 'running')
    ).rejects.toThrow('Plan not found');
  });

  it('should throw error when updating non-existent step', async () => {
    const plan = createTestPlan();
    await storage.create(plan);

    await expect(
      storage.updateStepStatus(plan.id, 'non-existent-step', 'running')
    ).rejects.toThrow('Step not found');
  });

  it('should return empty list when no plans exist', async () => {
    const result = await storage.list();
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});
