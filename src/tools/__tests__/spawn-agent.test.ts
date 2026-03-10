// src/tools/__tests__/spawn-agent.test.ts — Tests for SpawnAgentTool

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpawnAgentTool } from '../spawn-agent.js';
import type { AgentRegistry } from '../../multi-agent/agent-registry.js';
import type { AgentInstance, SpawnConfig } from '../../types/agent.js';
import type { ToolContext } from '../../types/index.js';

describe('SpawnAgentTool', () => {
  let tool: SpawnAgentTool;
  let mockRegistry: AgentRegistry;
  let mockSpawn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock spawn function
    mockSpawn = vi.fn();
    
    // Create mock registry
    mockRegistry = {
      spawn: mockSpawn,
    } as unknown as AgentRegistry;

    tool = new SpawnAgentTool(mockRegistry);
  });

  describe('Parent ID Tracking', () => {
    it('should set parentId from context.agentId when spawning', async () => {
      const parentAgentId = 'parent-agent-123';
      const context: ToolContext = {
        agentId: parentAgentId,
      };

      // Mock agent instance that will be returned
      const mockAgent: AgentInstance = {
        id: 'spawned-agent-456',
        role: 'worker',
        name: 'worker-test',
        status: 'idle',
        config: {
          model: 'claude-sonnet-4',
          systemPrompt: '',
          maxSteps: 10,
        },
        parentId: parentAgentId,
        sessionId: 'session-789',
        createdAt: new Date().toISOString(),
        metadata: {},
      };

      mockSpawn.mockReturnValue(mockAgent);

      // Execute tool
      const result = await tool.execute(
        {
          role: 'worker',
          name: 'worker-test',
        },
        context
      );

      // Verify spawn was called with correct config including parentId
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'worker',
          name: 'worker-test',
          parentId: parentAgentId,
        })
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.id).toBe('spawned-agent-456');
    });

    it('should work without context (no parentId)', async () => {
      // Mock agent instance without parentId
      const mockAgent: AgentInstance = {
        id: 'spawned-agent-789',
        role: 'worker',
        name: 'worker-test',
        status: 'idle',
        config: {
          model: 'claude-sonnet-4',
          systemPrompt: '',
          maxSteps: 10,
        },
        sessionId: 'session-abc',
        createdAt: new Date().toISOString(),
        metadata: {},
      };

      mockSpawn.mockReturnValue(mockAgent);

      // Execute tool without context
      const result = await tool.execute({
        role: 'worker',
        name: 'worker-test',
      });

      // Verify spawn was called with config (parentId will be undefined)
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'worker',
          name: 'worker-test',
          parentId: undefined,
        })
      );

      expect(result.success).toBe(true);
    });

    it('should propagate parentId through multiple levels', async () => {
      // Simulate a 3-level hierarchy: root -> level1 -> level2
      const rootAgentId = 'root-agent';
      const level1AgentId = 'level1-agent';

      // Level 1 spawn (root spawns level1)
      const mockAgent1: AgentInstance = {
        id: level1AgentId,
        role: 'worker',
        name: 'level1-worker',
        status: 'idle',
        config: {
          model: 'claude-sonnet-4',
          systemPrompt: '',
          maxSteps: 10,
        },
        parentId: rootAgentId,
        sessionId: 'session-1',
        createdAt: new Date().toISOString(),
        metadata: {},
      };

      mockSpawn.mockReturnValueOnce(mockAgent1);

      const result1 = await tool.execute(
        { role: 'worker' },
        { agentId: rootAgentId }
      );

      expect(result1.success).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: rootAgentId })
      );

      // Level 2 spawn (level1 spawns level2)
      const mockAgent2: AgentInstance = {
        id: 'level2-agent',
        role: 'worker',
        name: 'level2-worker',
        status: 'idle',
        config: {
          model: 'claude-sonnet-4',
          systemPrompt: '',
          maxSteps: 10,
        },
        parentId: level1AgentId,
        sessionId: 'session-2',
        createdAt: new Date().toISOString(),
        metadata: {},
      };

      mockSpawn.mockReturnValueOnce(mockAgent2);

      const result2 = await tool.execute(
        { role: 'worker' },
        { agentId: level1AgentId }
      );

      expect(result2.success).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: level1AgentId })
      );
    });
  });

  describe('Privilege Checks', () => {
    it('should prevent spawning planner agents', async () => {
      const context: ToolContext = {
        agentId: 'test-agent',
      };

      const result = await tool.execute(
        { role: 'planner' },
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Privilege violation');
      expect(result.error).toContain('planner');
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Forwarding', () => {
    it('should forward all spawn config parameters', async () => {
      const context: ToolContext = {
        agentId: 'parent-123',
      };

      const mockAgent: AgentInstance = {
        id: 'spawned-456',
        role: 'custom',
        name: 'custom-worker',
        status: 'idle',
        config: {
          model: 'claude-opus-4',
          systemPrompt: 'Custom prompt',
          tools: ['read', 'write'],
          maxSteps: 20,
        },
        parentId: 'parent-123',
        sessionId: 'session-xyz',
        createdAt: new Date().toISOString(),
        metadata: {},
      };

      mockSpawn.mockReturnValue(mockAgent);

      const result = await tool.execute(
        {
          role: 'custom',
          name: 'custom-worker',
          model: 'claude-opus-4',
          systemPrompt: 'Custom prompt',
          tools: ['read', 'write'],
          maxSteps: 20,
          cwd: '/custom/path',
        },
        context
      );

      expect(mockSpawn).toHaveBeenCalledWith({
        role: 'custom',
        name: 'custom-worker',
        model: 'claude-opus-4',
        systemPrompt: 'Custom prompt',
        tools: ['read', 'write'],
        maxSteps: 20,
        cwd: '/custom/path',
        parentId: 'parent-123',
      });

      expect(result.success).toBe(true);
    });
  });
});
