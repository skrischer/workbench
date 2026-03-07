import { describe, it, expect } from 'vitest';
import type { Agent, Tool, Session, Run, Task, Plan, Step } from '../index.js';

describe('Shared Types', () => {
  it('should create a valid Agent', () => {
    const agent: Agent = {
      id: 'test-agent',
      name: 'Test Agent',
      model: 'claude-sonnet-4-5-20250514',
      systemPrompt: 'You are a test agent.',
      tools: ['read', 'write'],
      maxSteps: 10,
    };
    expect(agent.id).toBe('test-agent');
    expect(agent.tools).toHaveLength(2);
  });

  it('should create a valid Session', () => {
    const session: Session = {
      id: 'session-1',
      agentId: 'test-agent',
      messages: [],
      toolCalls: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(session.status).toBe('active');
  });

  it('should create a valid Plan with Steps', () => {
    const step: Step = {
      id: 'step-1',
      planId: 'plan-1',
      title: 'First step',
      description: 'Do something',
      order: 1,
      status: 'pending',
    };
    const plan: Plan = {
      id: 'plan-1',
      taskId: 'task-1',
      title: 'Test Plan',
      description: 'A test plan',
      steps: [step],
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].order).toBe(1);
  });
});
