// src/task/__tests__/validation.test.ts — Validation Tests

import { describe, it, expect } from 'vitest';
import { validateStep, validatePlan } from '../validation.js';
import type { Step, Plan } from '../../types/task.js';

describe('validateStep', () => {
  it('should validate a valid step', () => {
    const validStep: Step = {
      id: 'step-1',
      title: 'Test Step',
      prompt: 'Do something',
      status: 'pending',
    };

    expect(() => validateStep(validStep)).not.toThrow();
  });

  it('should throw when step is missing id', () => {
    const invalidStep = {
      title: 'Test Step',
      prompt: 'Do something',
      status: 'pending',
    };

    expect(() => validateStep(invalidStep)).toThrow('Step must have a non-empty id');
  });

  it('should throw when step id is empty string', () => {
    const invalidStep = {
      id: '   ',
      title: 'Test Step',
      prompt: 'Do something',
      status: 'pending',
    };

    expect(() => validateStep(invalidStep)).toThrow('Step must have a non-empty id');
  });

  it('should throw when step is missing title', () => {
    const invalidStep = {
      id: 'step-1',
      prompt: 'Do something',
      status: 'pending',
    };

    expect(() => validateStep(invalidStep)).toThrow('Step must have a non-empty title');
  });

  it('should throw when step is missing prompt', () => {
    const invalidStep = {
      id: 'step-1',
      title: 'Test Step',
      status: 'pending',
    };

    expect(() => validateStep(invalidStep)).toThrow('Step must have a non-empty prompt');
  });

  it('should throw when step has invalid status', () => {
    const invalidStep = {
      id: 'step-1',
      title: 'Test Step',
      prompt: 'Do something',
      status: 'invalid-status',
    };

    expect(() => validateStep(invalidStep)).toThrow('Step status must be one of:');
  });

  it('should validate step with optional fields', () => {
    const validStep: Step = {
      id: 'step-1',
      title: 'Test Step',
      prompt: 'Do something',
      status: 'pending',
      dependsOn: ['step-0'],
      toolHints: ['read', 'write'],
      maxSteps: 10,
    };

    expect(() => validateStep(validStep)).not.toThrow();
  });

  it('should throw when dependsOn is not an array', () => {
    const invalidStep = {
      id: 'step-1',
      title: 'Test Step',
      prompt: 'Do something',
      status: 'pending',
      dependsOn: 'not-an-array',
    };

    expect(() => validateStep(invalidStep)).toThrow('Step dependsOn must be an array');
  });

  it('should throw when toolHints is not an array', () => {
    const invalidStep = {
      id: 'step-1',
      title: 'Test Step',
      prompt: 'Do something',
      status: 'pending',
      toolHints: 'not-an-array',
    };

    expect(() => validateStep(invalidStep)).toThrow('Step toolHints must be an array');
  });

  it('should throw when maxSteps is not a positive number', () => {
    const invalidStep = {
      id: 'step-1',
      title: 'Test Step',
      prompt: 'Do something',
      status: 'pending',
      maxSteps: -5,
    };

    expect(() => validateStep(invalidStep)).toThrow('Step maxSteps must be a positive number');
  });

  it('should accept all valid step statuses', () => {
    const statuses = ['pending', 'running', 'completed', 'failed', 'skipped'];

    for (const status of statuses) {
      const validStep = {
        id: 'step-1',
        title: 'Test Step',
        prompt: 'Do something',
        status,
      };

      expect(() => validateStep(validStep)).not.toThrow();
    }
  });
});

describe('validatePlan', () => {
  const createValidPlan = (): Plan => ({
    id: 'plan-1',
    title: 'Test Plan',
    description: 'A test plan',
    status: 'pending',
    steps: [
      {
        id: 'step-1',
        title: 'First Step',
        prompt: 'Do first thing',
        status: 'pending',
      },
    ],
    currentStepIndex: 0,
    createdAt: '2026-03-07T21:00:00Z',
    updatedAt: '2026-03-07T21:00:00Z',
    metadata: {
      originalPrompt: 'Create a test plan',
      model: 'claude-sonnet-4',
    },
  });

  it('should validate a valid plan', () => {
    const validPlan = createValidPlan();
    expect(() => validatePlan(validPlan)).not.toThrow();
  });

  it('should throw when plan is missing id', () => {
    const validPlan = createValidPlan();
    const invalidPlan = { ...validPlan, id: undefined as any };

    expect(() => validatePlan(invalidPlan)).toThrow('Plan must have a non-empty id');
  });

  it('should throw when plan is missing title', () => {
    const validPlan = createValidPlan();
    const invalidPlan = { ...validPlan, title: undefined as any };

    expect(() => validatePlan(invalidPlan)).toThrow('Plan must have a non-empty title');
  });

  it('should throw when plan has no steps', () => {
    const invalidPlan = createValidPlan();
    invalidPlan.steps = [];

    expect(() => validatePlan(invalidPlan)).toThrow('Plan must have at least one step');
  });

  it('should throw when plan has invalid status', () => {
    const invalidPlan = createValidPlan();
    (invalidPlan as any).status = 'invalid-status';

    expect(() => validatePlan(invalidPlan)).toThrow('Plan status must be one of:');
  });

  it('should throw when a step in the plan is invalid', () => {
    const invalidPlan = createValidPlan();
    invalidPlan.steps[0].id = '';

    expect(() => validatePlan(invalidPlan)).toThrow('Invalid step at index 0');
  });

  it('should throw when currentStepIndex is negative', () => {
    const invalidPlan = createValidPlan();
    invalidPlan.currentStepIndex = -1;

    expect(() => validatePlan(invalidPlan)).toThrow(
      'Plan currentStepIndex must be a non-negative number'
    );
  });

  it('should throw when createdAt is missing', () => {
    const validPlan = createValidPlan();
    const invalidPlan = { ...validPlan, createdAt: undefined as any };

    expect(() => validatePlan(invalidPlan)).toThrow('Plan must have a createdAt timestamp');
  });

  it('should throw when updatedAt is missing', () => {
    const validPlan = createValidPlan();
    const invalidPlan = { ...validPlan, updatedAt: undefined as any };

    expect(() => validatePlan(invalidPlan)).toThrow('Plan must have an updatedAt timestamp');
  });

  it('should throw when metadata is missing', () => {
    const validPlan = createValidPlan();
    const invalidPlan = { ...validPlan, metadata: undefined as any };

    expect(() => validatePlan(invalidPlan)).toThrow('Plan must have a metadata object');
  });

  it('should throw when metadata.originalPrompt is missing', () => {
    const validPlan = createValidPlan();
    const invalidPlan = {
      ...validPlan,
      metadata: { ...validPlan.metadata, originalPrompt: undefined as any },
    };

    expect(() => validatePlan(invalidPlan)).toThrow('Plan metadata must have an originalPrompt');
  });

  it('should throw when metadata.model is missing', () => {
    const invalidPlan = createValidPlan();
    invalidPlan.metadata = { ...invalidPlan.metadata, model: undefined as any };

    expect(() => validatePlan(invalidPlan)).toThrow('Plan metadata must have a model');
  });

  it('should accept all valid plan statuses', () => {
    const statuses = ['pending', 'running', 'completed', 'failed', 'paused'];

    for (const status of statuses) {
      const validPlan = createValidPlan();
      (validPlan as any).status = status;

      expect(() => validatePlan(validPlan)).not.toThrow();
    }
  });

  it('should validate plan with multiple steps', () => {
    const validPlan = createValidPlan();
    validPlan.steps.push({
      id: 'step-2',
      title: 'Second Step',
      prompt: 'Do second thing',
      status: 'pending',
    });

    expect(() => validatePlan(validPlan)).not.toThrow();
  });

  it('should validate plan with optional totalTokenUsage in metadata', () => {
    const validPlan = createValidPlan();
    validPlan.metadata.totalTokenUsage = {
      totalInputTokens: 100,
      totalOutputTokens: 200,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: 300,
      stepCount: 1,
    };

    expect(() => validatePlan(validPlan)).not.toThrow();
  });

  it('should throw clear error message for nested step validation failures', () => {
    const invalidPlan = createValidPlan();
    invalidPlan.steps[0].status = 'invalid' as any;

    expect(() => validatePlan(invalidPlan)).toThrow('Invalid step at index 0');
    expect(() => validatePlan(invalidPlan)).toThrow('Step status must be one of:');
  });
});
