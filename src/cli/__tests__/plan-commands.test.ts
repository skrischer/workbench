// src/cli/__tests__/plan-commands.test.ts — Tests for Plan CLI Commands

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatPlanPreview } from '../plan-command.js';
import { formatPlanList } from '../plans-command.js';
import { createPlanCommand } from '../plan-command.js';
import { createRunPlanCommand } from '../run-plan-command.js';
import { createPlansCommand } from '../plans-command.js';
import type { Plan, PlanStatus } from '../../types/task.js';

describe('plan-command', () => {
  describe('formatPlanPreview', () => {
    it('should format a plan with steps as a table', () => {
      const plan: Plan = {
        id: 'test-plan-123',
        title: 'Test Plan',
        description: 'A test plan for testing',
        status: 'pending',
        steps: [
          {
            id: 'step-1',
            title: 'First step',
            prompt: 'Do something',
            status: 'pending',
          },
          {
            id: 'step-2',
            title: 'Second step',
            prompt: 'Do something else',
            status: 'pending',
          },
        ],
        currentStepIndex: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        metadata: {
          originalPrompt: 'Test prompt',
          model: 'test-model',
        },
      };

      const output = formatPlanPreview(plan);

      expect(output).toContain('Test Plan');
      expect(output).toContain('A test plan for testing');
      expect(output).toContain('First step');
      expect(output).toContain('Second step');
      expect(output).toContain('test-plan-123');
      expect(output).toContain('Total Steps: 2');
    });

    it('should truncate long step titles', () => {
      const plan: Plan = {
        id: 'test-plan-456',
        title: 'Plan with long title',
        description: 'Description',
        status: 'pending',
        steps: [
          {
            id: 'step-1',
            title: 'This is a very long step title that should be truncated because it exceeds the maximum width allowed',
            prompt: 'Do something',
            status: 'pending',
          },
        ],
        currentStepIndex: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        metadata: {
          originalPrompt: 'Test',
          model: 'test',
        },
      };

      const output = formatPlanPreview(plan);

      expect(output).toContain('...');
      expect(output).not.toContain('because it exceeds the maximum width allowed');
    });

    it('should display step numbers starting from 1', () => {
      const plan: Plan = {
        id: 'test-plan-789',
        title: 'Numbered Steps',
        description: 'Test',
        status: 'pending',
        steps: [
          {
            id: 'step-1',
            title: 'First',
            prompt: 'First',
            status: 'pending',
          },
          {
            id: 'step-2',
            title: 'Second',
            prompt: 'Second',
            status: 'pending',
          },
          {
            id: 'step-3',
            title: 'Third',
            prompt: 'Third',
            status: 'pending',
          },
        ],
        currentStepIndex: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        metadata: {
          originalPrompt: 'Test',
          model: 'test',
        },
      };

      const output = formatPlanPreview(plan);

      expect(output).toMatch(/1\s+\|.*First/);
      expect(output).toMatch(/2\s+\|.*Second/);
      expect(output).toMatch(/3\s+\|.*Third/);
    });
  });

  describe('createPlanCommand', () => {
    it('should create a command with correct name', () => {
      const command = createPlanCommand();
      expect(command.name()).toBe('plan');
    });

    it('should accept a prompt argument', () => {
      const command = createPlanCommand();
      const args = command.registeredArguments;
      
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('prompt');
      expect(args[0].required).toBe(true);
    });

    it('should have --auto-run option', () => {
      const command = createPlanCommand();
      const options = command.options;
      
      const autoRunOption = options.find(opt => opt.long === '--auto-run');
      expect(autoRunOption).toBeDefined();
    });

    it('should have --model option', () => {
      const command = createPlanCommand();
      const options = command.options;
      
      const modelOption = options.find(opt => opt.long === '--model');
      expect(modelOption).toBeDefined();
    });
  });
});

describe('plans-command', () => {
  describe('formatPlanList', () => {
    it('should format empty list', () => {
      const output = formatPlanList([]);
      
      expect(output).toContain('No plans found');
    });

    it('should format list with multiple plans', () => {
      const plans = [
        {
          id: 'plan-1',
          title: 'First Plan',
          status: 'completed' as PlanStatus,
          stepCount: 3,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T01:00:00Z',
        },
        {
          id: 'plan-2',
          title: 'Second Plan',
          status: 'running' as PlanStatus,
          stepCount: 5,
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:30:00Z',
        },
      ];

      const output = formatPlanList(plans);

      expect(output).toContain('Plans (2)');
      expect(output).toContain('First Plan');
      expect(output).toContain('Second Plan');
      expect(output).toContain('completed');
      expect(output).toContain('running');
      expect(output).toContain('3');
      expect(output).toContain('5');
    });

    it('should truncate long plan titles', () => {
      const plans = [
        {
          id: 'plan-long',
          title: 'This is a very long plan title that should definitely be truncated because it is way too long',
          status: 'pending' as PlanStatus,
          stepCount: 2,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const output = formatPlanList(plans);

      expect(output).toContain('...');
      expect(output).not.toContain('because it is way too long');
    });

    it('should show plan count in header', () => {
      const plans = [
        {
          id: 'p1',
          title: 'Plan 1',
          status: 'pending' as PlanStatus,
          stepCount: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'p2',
          title: 'Plan 2',
          status: 'pending' as PlanStatus,
          stepCount: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'p3',
          title: 'Plan 3',
          status: 'pending' as PlanStatus,
          stepCount: 1,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const output = formatPlanList(plans);

      expect(output).toContain('Plans (3)');
    });
  });

  describe('createPlansCommand', () => {
    it('should create a command with correct name', () => {
      const command = createPlansCommand();
      expect(command.name()).toBe('plans');
    });

    it('should have --status option', () => {
      const command = createPlansCommand();
      const options = command.options;
      
      const statusOption = options.find(opt => opt.long === '--status');
      expect(statusOption).toBeDefined();
    });

    it('should accept no required arguments', () => {
      const command = createPlansCommand();
      const args = command.registeredArguments;
      
      expect(args).toHaveLength(0);
    });
  });
});

describe('run-plan-command', () => {
  describe('createRunPlanCommand', () => {
    it('should create a command with correct name', () => {
      const command = createRunPlanCommand();
      expect(command.name()).toBe('run-plan');
    });

    it('should accept plan-id argument', () => {
      const command = createRunPlanCommand();
      const args = command.registeredArguments;
      
      expect(args).toHaveLength(1);
      expect(args[0].name()).toBe('plan-id');
      expect(args[0].required).toBe(true);
    });

    it('should have --resume option', () => {
      const command = createRunPlanCommand();
      const options = command.options;
      
      const resumeOption = options.find(opt => opt.long === '--resume');
      expect(resumeOption).toBeDefined();
    });

    it('should have --model option', () => {
      const command = createRunPlanCommand();
      const options = command.options;
      
      const modelOption = options.find(opt => opt.long === '--model');
      expect(modelOption).toBeDefined();
    });
  });
});

describe('CLI integration', () => {
  it('should export all command creation functions', () => {
    expect(createPlanCommand).toBeDefined();
    expect(createRunPlanCommand).toBeDefined();
    expect(createPlansCommand).toBeDefined();
  });

  it('should export formatting functions', () => {
    expect(formatPlanPreview).toBeDefined();
    expect(formatPlanList).toBeDefined();
  });
});
