// src/multi-agent/__tests__/agent-registry.test.ts — AgentRegistry Unit Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from '../agent-registry.js';
import { eventBus } from '../../events/event-bus.js';
import type { SpawnConfig, AgentRole } from '../../types/agent.js';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    eventBus.clear(); // Clear all event listeners
  });

  describe('spawn', () => {
    it('should create a valid AgentInstance with UUID', () => {
      const config: SpawnConfig = {
        role: 'worker',
      };

      const agent = registry.spawn(config);

      expect(agent.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(agent.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(agent.role).toBe('worker');
      expect(agent.status).toBe('idle');
      expect(agent.name).toContain('worker');
      expect(agent.createdAt).toBeTruthy();
      expect(agent.metadata).toEqual({});
    });

    it('should use custom name if provided', () => {
      const config: SpawnConfig = {
        role: 'planner',
        name: 'my-custom-planner',
      };

      const agent = registry.spawn(config);

      expect(agent.name).toBe('my-custom-planner');
    });

    it('should emit agent:spawned event', () => {
      const listener = vi.fn();
      eventBus.on('agent:spawned', listener);

      const config: SpawnConfig = {
        role: 'reviewer',
      };

      const agent = registry.spawn(config);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        id: agent.id,
        role: 'reviewer',
        sessionId: agent.sessionId,
      });
    });

    it('should throw error when max agent limit is reached', () => {
      const smallRegistry = new AgentRegistry(2);

      smallRegistry.spawn({ role: 'worker' });
      smallRegistry.spawn({ role: 'planner' });

      expect(() => {
        smallRegistry.spawn({ role: 'reviewer' });
      }).toThrow('Max agent limit reached (2)');
    });

    it('should throw error for invalid config', () => {
      expect(() => {
        registry.spawn({ role: '' as any });
      }).toThrow();

      expect(() => {
        registry.spawn({ role: 'invalid-role' as any });
      }).toThrow();
    });
  });

  describe('terminate', () => {
    it('should set status to terminated and remove agent', () => {
      const agent = registry.spawn({ role: 'worker' });

      expect(registry.get(agent.id)).toBeDefined();

      registry.terminate(agent.id);

      expect(registry.get(agent.id)).toBeUndefined();
    });

    it('should emit agent:terminated event', () => {
      const listener = vi.fn();
      eventBus.on('agent:terminated', listener);

      const agent = registry.spawn({ role: 'worker' });
      registry.terminate(agent.id);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        id: agent.id,
        role: 'worker',
      });
    });

    it('should throw error when agent not found', () => {
      expect(() => {
        registry.terminate('non-existent-id');
      }).toThrow('Agent not found: non-existent-id');
    });
  });

  describe('get', () => {
    it('should retrieve agent by ID', () => {
      const agent = registry.spawn({ role: 'planner' });

      const retrieved = registry.get(agent.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(agent.id);
      expect(retrieved?.role).toBe('planner');
    });

    it('should return undefined for non-existent agent', () => {
      const result = registry.get('non-existent-id');

      expect(result).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return all agents when no filter provided', () => {
      registry.spawn({ role: 'worker' });
      registry.spawn({ role: 'planner' });
      registry.spawn({ role: 'reviewer' });

      const agents = registry.list();

      expect(agents).toHaveLength(3);
    });

    it('should filter agents by role', () => {
      registry.spawn({ role: 'worker' });
      registry.spawn({ role: 'planner' });
      registry.spawn({ role: 'worker' });

      const workers = registry.list({ role: 'worker' });

      expect(workers).toHaveLength(2);
      expect(workers.every((a) => a.role === 'worker')).toBe(true);
    });

    it('should filter agents by status', () => {
      const agent1 = registry.spawn({ role: 'worker' });
      const agent2 = registry.spawn({ role: 'planner' });
      registry.spawn({ role: 'reviewer' });

      registry.onStatusChange(agent1.id, 'running');
      registry.onStatusChange(agent2.id, 'running');

      const runningAgents = registry.list({ status: 'running' });

      expect(runningAgents).toHaveLength(2);
      expect(runningAgents.every((a) => a.status === 'running')).toBe(true);
    });

    it('should filter agents by role and status', () => {
      const agent1 = registry.spawn({ role: 'worker' });
      const agent2 = registry.spawn({ role: 'worker' });
      registry.spawn({ role: 'planner' });

      registry.onStatusChange(agent1.id, 'running');
      registry.onStatusChange(agent2.id, 'completed');

      const runningWorkers = registry.list({ role: 'worker', status: 'running' });

      expect(runningWorkers).toHaveLength(1);
      expect(runningWorkers[0].id).toBe(agent1.id);
    });
  });

  describe('getByRole', () => {
    it('should return all agents with specified role', () => {
      registry.spawn({ role: 'worker' });
      registry.spawn({ role: 'planner' });
      registry.spawn({ role: 'worker' });

      const workers = registry.getByRole('worker');

      expect(workers).toHaveLength(2);
      expect(workers.every((a) => a.role === 'worker')).toBe(true);
    });

    it('should return empty array when no agents match role', () => {
      registry.spawn({ role: 'worker' });

      const planners = registry.getByRole('planner');

      expect(planners).toHaveLength(0);
    });
  });

  describe('onStatusChange', () => {
    it('should update agent status and emit event', () => {
      const listener = vi.fn();
      eventBus.on('agent:status', listener);

      const agent = registry.spawn({ role: 'worker' });

      registry.onStatusChange(agent.id, 'running');

      expect(agent.status).toBe('running');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({
        id: agent.id,
        status: 'running',
        previousStatus: 'idle',
      });
    });

    it('should track status transitions', () => {
      const listener = vi.fn();
      eventBus.on('agent:status', listener);

      const agent = registry.spawn({ role: 'worker' });

      registry.onStatusChange(agent.id, 'running');
      registry.onStatusChange(agent.id, 'completed');

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenNthCalledWith(1, {
        id: agent.id,
        status: 'running',
        previousStatus: 'idle',
      });
      expect(listener).toHaveBeenNthCalledWith(2, {
        id: agent.id,
        status: 'completed',
        previousStatus: 'running',
      });
    });

    it('should throw error when agent not found', () => {
      expect(() => {
        registry.onStatusChange('non-existent-id', 'running');
      }).toThrow('Agent not found: non-existent-id');
    });
  });

  describe('count', () => {
    it('should return the number of active agents', () => {
      expect(registry.count).toBe(0);

      registry.spawn({ role: 'worker' });
      expect(registry.count).toBe(1);

      registry.spawn({ role: 'planner' });
      expect(registry.count).toBe(2);

      const agent = registry.spawn({ role: 'reviewer' });
      expect(registry.count).toBe(3);

      registry.terminate(agent.id);
      expect(registry.count).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid spawn/terminate cycles', () => {
      const agent1 = registry.spawn({ role: 'worker' });
      registry.terminate(agent1.id);

      const agent2 = registry.spawn({ role: 'worker' });
      expect(registry.count).toBe(1);
      expect(registry.get(agent2.id)).toBeDefined();
      expect(registry.get(agent1.id)).toBeUndefined();
    });

    it('should maintain independent agent instances', () => {
      const agent1 = registry.spawn({ role: 'worker' });
      const agent2 = registry.spawn({ role: 'worker' });

      registry.onStatusChange(agent1.id, 'running');

      expect(agent1.status).toBe('running');
      expect(agent2.status).toBe('idle');
    });

    it('should handle maxAgents constructor validation', () => {
      expect(() => new AgentRegistry(0)).toThrow('maxAgents must be a positive integer');
      expect(() => new AgentRegistry(-5)).toThrow('maxAgents must be a positive integer');
      expect(() => new AgentRegistry(1.5)).toThrow('maxAgents must be a positive integer');
    });
  });
});
