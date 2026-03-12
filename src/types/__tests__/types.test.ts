import { describe, it, expect } from 'vitest';
import type { Agent, Session } from '../index.js';

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
});
