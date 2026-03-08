// src/task/__tests__/plan-generator.test.ts — Tests for LLM-based Plan Generation

import { describe, it, expect, vi } from 'vitest';
import { PlanGenerator, generatePlan } from '../plan-generator.js';
import type { PlanGeneratorConfig } from '../plan-generator.js';

describe('PlanGenerator', () => {
  const validPlanJSON = {
    title: 'Test Feature Implementation',
    description: 'Implement a test feature with validation',
    steps: [
      {
        id: 'step-1',
        title: 'Create types',
        prompt: 'Create src/types/test.ts with TestInterface',
        status: 'pending' as const,
        toolHints: ['write'],
        maxSteps: 10,
      },
      {
        id: 'step-2',
        title: 'Implement logic',
        prompt: 'Create src/logic/test.ts with test implementation',
        status: 'pending' as const,
        dependsOn: ['step-1'],
        toolHints: ['write', 'read'],
        maxSteps: 20,
      },
      {
        id: 'step-3',
        title: 'Add tests',
        prompt: 'Create src/__tests__/test.test.ts with unit tests',
        status: 'pending' as const,
        dependsOn: ['step-2'],
        toolHints: ['write', 'exec'],
        maxSteps: 15,
      },
    ],
  };

  const createMockConfig = (
    response: string | ((attempt: number) => string)
  ): PlanGeneratorConfig => {
    let callCount = 0;
    return {
      model: 'test-model-v1',
      llmCall: vi.fn(async () => {
        const result = typeof response === 'function' ? response(callCount) : response;
        callCount++;
        return result;
      }),
    };
  };

  it('should generate a valid plan from direct JSON response', async () => {
    const config = createMockConfig(JSON.stringify(validPlanJSON));
    const generator = new PlanGenerator(config);

    const plan = await generator.generate('Build a test feature');

    expect(plan).toBeDefined();
    expect(plan.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    expect(plan.title).toBe('Test Feature Implementation');
    expect(plan.description).toBe('Implement a test feature with validation');
    expect(plan.status).toBe('pending');
    expect(plan.steps).toHaveLength(3);
    expect(plan.currentStepIndex).toBe(0);
    expect(plan.createdAt).toBeDefined();
    expect(plan.updatedAt).toBeDefined();
    expect(plan.metadata.originalPrompt).toBe('Build a test feature');
    expect(plan.metadata.model).toBe('test-model-v1');

    // Verify steps
    expect(plan.steps[0].id).toBe('step-1');
    expect(plan.steps[0].status).toBe('pending');
    expect(plan.steps[1].dependsOn).toEqual(['step-1']);
    expect(plan.steps[2].dependsOn).toEqual(['step-2']);
  });

  it('should extract JSON from markdown code block', async () => {
    const markdownResponse = `Here's the plan:\n\n\`\`\`json\n${JSON.stringify(validPlanJSON, null, 2)}\n\`\`\`\n\nThis should work!`;
    const config = createMockConfig(markdownResponse);
    const generator = new PlanGenerator(config);

    const plan = await generator.generate('Build a test feature');

    expect(plan).toBeDefined();
    expect(plan.title).toBe('Test Feature Implementation');
    expect(plan.steps).toHaveLength(3);
  });

  it('should extract JSON from code block without json specifier', async () => {
    const markdownResponse = `\`\`\`\n${JSON.stringify(validPlanJSON)}\n\`\`\``;
    const config = createMockConfig(markdownResponse);
    const generator = new PlanGenerator(config);

    const plan = await generator.generate('Build a test feature');

    expect(plan).toBeDefined();
    expect(plan.title).toBe('Test Feature Implementation');
  });

  it('should retry once on validation error and succeed', async () => {
    const invalidPlan = {
      title: '', // Invalid - empty title
      description: 'Test',
      steps: [],
    };

    let attemptCount = 0;
    const config = createMockConfig((attempt) => {
      attemptCount++;
      return attempt === 0 ? JSON.stringify(invalidPlan) : JSON.stringify(validPlanJSON);
    });

    const generator = new PlanGenerator(config);
    const plan = await generator.generate('Build a test feature');

    expect(attemptCount).toBe(2); // First failed, second succeeded
    expect(plan).toBeDefined();
    expect(plan.title).toBe('Test Feature Implementation');
    expect(config.llmCall).toHaveBeenCalledTimes(2);
  });

  it('should throw error after max retries on persistent validation failures', async () => {
    const invalidPlan = {
      title: '', // Always invalid
      description: 'Test',
      steps: [],
    };

    const config = createMockConfig(JSON.stringify(invalidPlan));
    const generator = new PlanGenerator(config);

    await expect(generator.generate('Build a test feature')).rejects.toThrow(
      /Plan generation failed after 2 attempt\(s\)/
    );

    expect(config.llmCall).toHaveBeenCalledTimes(2); // Initial + 1 retry
  });

  it('should throw error on invalid JSON response', async () => {
    const config = createMockConfig('This is not JSON at all!');
    const generator = new PlanGenerator(config);

    await expect(generator.generate('Build a test feature')).rejects.toThrow(
      /Plan generation failed/
    );
  });

  it('should pass error message to LLM on retry', async () => {
    const invalidPlan = { title: '', description: 'Test', steps: [] };

    const config = createMockConfig((attempt) => {
      return attempt === 0 ? JSON.stringify(invalidPlan) : JSON.stringify(validPlanJSON);
    });

    const generator = new PlanGenerator(config);
    await generator.generate('Build a test feature');

    // Check that second call includes error feedback
    const secondCallArgs = (config.llmCall as any).mock.calls[1][0];
    expect(secondCallArgs).toHaveLength(3); // system + user + error feedback
    expect(secondCallArgs[2].content).toContain('previous plan had an error');
    expect(secondCallArgs[2].content).toContain('Plan must have a non-empty title');
  });

  it('should respect custom maxRetries config', async () => {
    const invalidPlan = { title: '', description: 'Test', steps: [] };
    const config = createMockConfig(JSON.stringify(invalidPlan));
    config.maxRetries = 3; // Allow 3 retries instead of default 1

    const generator = new PlanGenerator(config);

    await expect(generator.generate('Build a test feature')).rejects.toThrow(
      /Plan generation failed after 4 attempt\(s\)/ // 1 initial + 3 retries
    );

    expect(config.llmCall).toHaveBeenCalledTimes(4);
  });

  it('should work with generatePlan convenience function', async () => {
    const config = createMockConfig(JSON.stringify(validPlanJSON));

    const plan = await generatePlan('Build a test feature', config);

    expect(plan).toBeDefined();
    expect(plan.title).toBe('Test Feature Implementation');
    expect(plan.steps).toHaveLength(3);
  });

  it('should preserve all step fields including optional ones', async () => {
    const config = createMockConfig(JSON.stringify(validPlanJSON));
    const generator = new PlanGenerator(config);

    const plan = await generator.generate('Build a test feature');

    // Check step 1 (has toolHints, maxSteps, no dependsOn)
    expect(plan.steps[0].toolHints).toEqual(['write']);
    expect(plan.steps[0].maxSteps).toBe(10);
    expect(plan.steps[0].dependsOn).toBeUndefined();

    // Check step 2 (has all optional fields)
    expect(plan.steps[1].toolHints).toEqual(['write', 'read']);
    expect(plan.steps[1].maxSteps).toBe(20);
    expect(plan.steps[1].dependsOn).toEqual(['step-1']);
  });

  it('should reject plan with missing required step fields', async () => {
    const planWithInvalidStep = {
      ...validPlanJSON,
      steps: [
        {
          id: 'step-1',
          title: 'Test',
          // Missing required 'prompt' field
          status: 'pending',
        },
      ],
    };

    const config = createMockConfig(JSON.stringify(planWithInvalidStep));
    const generator = new PlanGenerator(config);

    await expect(generator.generate('Build a test feature')).rejects.toThrow(
      /Plan generation failed/
    );
  });
});
