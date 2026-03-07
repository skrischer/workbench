// src/tools/__tests__/agent-tools.test.ts — Tests for Multi-Agent Tools

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpawnAgentTool } from '../spawn-agent.js';
import { SendMessageTool } from '../send-message.js';
import { ListAgentsTool } from '../list-agents.js';
import { AgentRegistry } from '../../multi-agent/agent-registry.js';
import { MessageBus } from '../../multi-agent/message-bus.js';
import type { AgentInstance, SpawnConfig } from '../../types/agent.js';

describe('SpawnAgentTool', () => {
  let registry: AgentRegistry;
  let tool: SpawnAgentTool;

  beforeEach(() => {
    registry = new AgentRegistry(10);
    tool = new SpawnAgentTool(registry);
  });

  it('should spawn a worker agent successfully', async () => {
    const result = await tool.execute({
      role: 'worker',
      name: 'test-worker',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Agent spawned successfully');
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.role).toBe('worker');
    expect(result.metadata?.name).toBe('test-worker');
    expect(registry.count).toBe(1);
  });

  it('should spawn a reviewer agent successfully', async () => {
    const result = await tool.execute({
      role: 'reviewer',
      name: 'test-reviewer',
      model: 'custom-model',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Agent spawned successfully');
    expect(result.metadata?.role).toBe('reviewer');
    expect(result.metadata?.name).toBe('test-reviewer');
    expect(registry.count).toBe(1);
  });

  it('should reject spawning planner agents (privilege check)', async () => {
    const result = await tool.execute({
      role: 'planner',
      name: 'malicious-planner',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Privilege violation');
    expect(result.error).toContain('planner');
    expect(registry.count).toBe(0);
  });

  it('should fail when spawning without required role', async () => {
    const result = await tool.execute({
      name: 'no-role-agent',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(registry.count).toBe(0);
  });

  it('should spawn agent with all optional config fields', async () => {
    const result = await tool.execute({
      role: 'worker',
      name: 'full-config-agent',
      model: 'gpt-4',
      systemPrompt: 'You are a helpful assistant',
      tools: ['read_file', 'write_file'],
      maxSteps: 20,
      cwd: '/tmp/test',
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.role).toBe('worker');
    expect(result.metadata?.name).toBe('full-config-agent');
  });
});

describe('SendMessageTool', () => {
  let bus: MessageBus;
  let tool: SendMessageTool;

  beforeEach(() => {
    bus = new MessageBus();
    tool = new SendMessageTool(bus);
  });

  it('should send a task message successfully', async () => {
    const result = await tool.execute({
      from: 'agent-1',
      to: 'agent-2',
      type: 'task',
      payload: { action: 'process', data: 'test' },
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Message sent');
    expect(result.metadata?.from).toBe('agent-1');
    expect(result.metadata?.to).toBe('agent-2');
    expect(result.metadata?.type).toBe('task');
  });

  it('should send all message types', async () => {
    const types = ['task', 'result', 'status', 'error'] as const;

    for (const type of types) {
      const result = await tool.execute({
        from: 'sender',
        to: 'receiver',
        type,
        payload: { type },
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.type).toBe(type);
    }
  });

  it('should fail when required fields are missing', async () => {
    const result = await tool.execute({
      from: 'agent-1',
      type: 'task',
      payload: { data: 'test' },
      // missing 'to'
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should queue message when recipient has no handler', async () => {
    const result = await tool.execute({
      from: 'agent-1',
      to: 'agent-2',
      type: 'task',
      payload: { data: 'test' },
    });

    expect(result.success).toBe(true);
    
    // Message should be queued
    const queue = bus.getQueue('agent-2');
    expect(queue).toHaveLength(1);
    expect(queue[0].from).toBe('agent-1');
  });
});

describe('ListAgentsTool', () => {
  let registry: AgentRegistry;
  let tool: ListAgentsTool;

  beforeEach(() => {
    registry = new AgentRegistry(10);
    tool = new ListAgentsTool(registry);
  });

  it('should list all agents when no filter is provided', async () => {
    // Spawn some agents
    registry.spawn({ role: 'worker', name: 'worker-1' });
    registry.spawn({ role: 'reviewer', name: 'reviewer-1' });

    const result = await tool.execute({});

    expect(result.success).toBe(true);
    expect(result.metadata?.count).toBe(2);
    expect(result.metadata?.agents).toHaveLength(2);
  });

  it('should filter agents by role', async () => {
    registry.spawn({ role: 'worker', name: 'worker-1' });
    registry.spawn({ role: 'worker', name: 'worker-2' });
    registry.spawn({ role: 'reviewer', name: 'reviewer-1' });

    const result = await tool.execute({
      role: 'worker',
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.count).toBe(2);
    expect(result.metadata?.filter).toEqual({ role: 'worker' });
  });

  it('should filter agents by status', async () => {
    const agent1 = registry.spawn({ role: 'worker' });
    const agent2 = registry.spawn({ role: 'reviewer' });
    
    // Update status of one agent
    registry.onStatusChange(agent1.id, 'running');

    const result = await tool.execute({
      status: 'running',
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.count).toBe(1);
    const agents = result.metadata?.agents as any[];
    expect(agents).toBeDefined();
    expect(agents[0].status).toBe('running');
  });

  it('should return empty result when no agents match filter', async () => {
    registry.spawn({ role: 'worker' });

    const result = await tool.execute({
      role: 'reviewer',
    });

    expect(result.success).toBe(true);
    expect(result.metadata?.count).toBe(0);
    expect(result.output).toContain('No agents found');
  });

  it('should handle empty registry gracefully', async () => {
    const result = await tool.execute({});

    expect(result.success).toBe(true);
    expect(result.metadata?.count).toBe(0);
    expect(result.output).toContain('No agents found');
  });

  it('should format agent list output correctly', async () => {
    registry.spawn({ role: 'worker', name: 'test-worker' });

    const result = await tool.execute({});

    expect(result.success).toBe(true);
    expect(result.output).toContain('Found 1 agent');
    expect(result.output).toContain('test-worker');
    expect(result.output).toContain('Role: worker');
  });
});

describe('Agent Tools Integration', () => {
  it('should work together: spawn, list, and send message', async () => {
    const registry = new AgentRegistry(10);
    const bus = new MessageBus();

    const spawnTool = new SpawnAgentTool(registry);
    const listTool = new ListAgentsTool(registry);
    const sendTool = new SendMessageTool(bus);

    // Spawn two agents
    const spawn1 = await spawnTool.execute({ role: 'worker', name: 'worker-1' });
    const spawn2 = await spawnTool.execute({ role: 'reviewer', name: 'reviewer-1' });

    expect(spawn1.success).toBe(true);
    expect(spawn2.success).toBe(true);

    // List agents
    const list = await listTool.execute({});
    expect(list.success).toBe(true);
    expect(list.metadata?.count).toBe(2);

    // Send message between agents
    const agent1Id = spawn1.metadata?.id as string;
    const agent2Id = spawn2.metadata?.id as string;

    const message = await sendTool.execute({
      from: agent1Id,
      to: agent2Id,
      type: 'task',
      payload: { task: 'review code' },
    });

    expect(message.success).toBe(true);
    expect(message.metadata?.from).toBe(agent1Id);
    expect(message.metadata?.to).toBe(agent2Id);
  });
});
