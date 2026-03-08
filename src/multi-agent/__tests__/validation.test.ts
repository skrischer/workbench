// src/multi-agent/__tests__/validation.test.ts — Validation Tests for Multi-Agent System

import { describe, it, expect } from 'vitest';
import { validateSpawnConfig, validateAgentMessage } from '../validation.js';
import type { SpawnConfig, AgentMessage } from '../../types/agent.js';

describe('validateSpawnConfig', () => {
  it('should validate a minimal valid SpawnConfig', () => {
    const validConfig: SpawnConfig = {
      role: 'worker',
    };

    expect(() => validateSpawnConfig(validConfig)).not.toThrow();
  });

  it('should validate a complete valid SpawnConfig', () => {
    const validConfig: SpawnConfig = {
      role: 'planner',
      name: 'Task Planner',
      model: 'claude-sonnet-4',
      systemPrompt: 'You are a task planner.',
      tools: ['read', 'write', 'exec'],
      maxSteps: 10,
      cwd: '/tmp/workdir',
    };

    expect(() => validateSpawnConfig(validConfig)).not.toThrow();
  });

  it('should throw when role is missing', () => {
    const invalidConfig = {
      name: 'Worker',
      model: 'claude-sonnet-4',
    };

    expect(() => validateSpawnConfig(invalidConfig)).toThrow(
      'SpawnConfig must have a non-empty role'
    );
  });

  it('should throw when role is empty string', () => {
    const invalidConfig = {
      role: '   ',
    };

    expect(() => validateSpawnConfig(invalidConfig)).toThrow(
      'SpawnConfig must have a non-empty role'
    );
  });

  it('should throw when role is invalid', () => {
    const invalidConfig = {
      role: 'invalid-role',
    };

    expect(() => validateSpawnConfig(invalidConfig)).toThrow(
      'SpawnConfig role must be one of: planner, worker, reviewer, custom'
    );
  });

  it('should accept all valid roles', () => {
    const validRoles = ['planner', 'worker', 'reviewer', 'custom'];

    for (const role of validRoles) {
      const config = { role };
      expect(() => validateSpawnConfig(config)).not.toThrow();
    }
  });

  it('should throw when maxSteps is zero', () => {
    const invalidConfig = {
      role: 'worker',
      maxSteps: 0,
    };

    expect(() => validateSpawnConfig(invalidConfig)).toThrow(
      'SpawnConfig maxSteps must be greater than 0 if provided'
    );
  });

  it('should throw when maxSteps is negative', () => {
    const invalidConfig = {
      role: 'worker',
      maxSteps: -5,
    };

    expect(() => validateSpawnConfig(invalidConfig)).toThrow(
      'SpawnConfig maxSteps must be greater than 0 if provided'
    );
  });

  it('should throw when maxSteps is not an integer', () => {
    const invalidConfig = {
      role: 'worker',
      maxSteps: 3.14,
    };

    expect(() => validateSpawnConfig(invalidConfig)).toThrow(
      'SpawnConfig maxSteps must be an integer if provided'
    );
  });

  it('should throw when name is empty string', () => {
    const invalidConfig = {
      role: 'worker',
      name: '   ',
    };

    expect(() => validateSpawnConfig(invalidConfig)).toThrow(
      'SpawnConfig name must be a non-empty string if provided'
    );
  });

  it('should throw when tools is not an array', () => {
    const invalidConfig = {
      role: 'worker',
      tools: 'not-an-array',
    };

    expect(() => validateSpawnConfig(invalidConfig)).toThrow(
      'SpawnConfig tools must be an array if provided'
    );
  });

  it('should throw when tools contains empty strings', () => {
    const invalidConfig = {
      role: 'worker',
      tools: ['read', '', 'write'],
    };

    expect(() => validateSpawnConfig(invalidConfig)).toThrow(
      'SpawnConfig tools must be an array of non-empty strings'
    );
  });

  it('should throw when config is not an object', () => {
    expect(() => validateSpawnConfig('not-an-object')).toThrow(
      'SpawnConfig must be an object'
    );
  });

  it('should throw when config is null', () => {
    expect(() => validateSpawnConfig(null)).toThrow('SpawnConfig must be an object');
  });
});

describe('validateAgentMessage', () => {
  it('should validate a valid AgentMessage', () => {
    const validMessage: AgentMessage = {
      from: 'agent-123',
      to: 'agent-456',
      type: 'task',
      payload: { instruction: 'Do something' },
      timestamp: '2026-03-07T21:30:00Z',
    };

    expect(() => validateAgentMessage(validMessage)).not.toThrow();
  });

  it('should validate message with null payload', () => {
    const validMessage: AgentMessage = {
      from: 'agent-123',
      to: 'agent-456',
      type: 'status',
      payload: null,
      timestamp: '2026-03-07T21:30:00Z',
    };

    expect(() => validateAgentMessage(validMessage)).not.toThrow();
  });

  it('should throw when from is missing', () => {
    const invalidMessage = {
      to: 'agent-456',
      type: 'task',
      payload: { instruction: 'Do something' },
      timestamp: '2026-03-07T21:30:00Z',
    };

    expect(() => validateAgentMessage(invalidMessage)).toThrow(
      'AgentMessage must have a non-empty from field'
    );
  });

  it('should throw when from is empty string', () => {
    const invalidMessage = {
      from: '   ',
      to: 'agent-456',
      type: 'task',
      payload: {},
      timestamp: '2026-03-07T21:30:00Z',
    };

    expect(() => validateAgentMessage(invalidMessage)).toThrow(
      'AgentMessage must have a non-empty from field'
    );
  });

  it('should throw when to is missing', () => {
    const invalidMessage = {
      from: 'agent-123',
      type: 'task',
      payload: { instruction: 'Do something' },
      timestamp: '2026-03-07T21:30:00Z',
    };

    expect(() => validateAgentMessage(invalidMessage)).toThrow(
      'AgentMessage must have a non-empty to field'
    );
  });

  it('should throw when to is empty string', () => {
    const invalidMessage = {
      from: 'agent-123',
      to: '   ',
      type: 'task',
      payload: {},
      timestamp: '2026-03-07T21:30:00Z',
    };

    expect(() => validateAgentMessage(invalidMessage)).toThrow(
      'AgentMessage must have a non-empty to field'
    );
  });

  it('should throw when type is missing', () => {
    const invalidMessage = {
      from: 'agent-123',
      to: 'agent-456',
      payload: { instruction: 'Do something' },
      timestamp: '2026-03-07T21:30:00Z',
    };

    expect(() => validateAgentMessage(invalidMessage)).toThrow(
      'AgentMessage must have a type field'
    );
  });

  it('should throw when type is invalid', () => {
    const invalidMessage = {
      from: 'agent-123',
      to: 'agent-456',
      type: 'invalid-type',
      payload: {},
      timestamp: '2026-03-07T21:30:00Z',
    };

    expect(() => validateAgentMessage(invalidMessage)).toThrow(
      'AgentMessage type must be one of: task, result, status, error'
    );
  });

  it('should accept all valid message types', () => {
    const validTypes = ['task', 'result', 'status', 'error'];

    for (const type of validTypes) {
      const message = {
        from: 'agent-123',
        to: 'agent-456',
        type,
        payload: {},
        timestamp: '2026-03-07T21:30:00Z',
      };

      expect(() => validateAgentMessage(message)).not.toThrow();
    }
  });

  it('should throw when payload is missing', () => {
    const invalidMessage = {
      from: 'agent-123',
      to: 'agent-456',
      type: 'task',
      timestamp: '2026-03-07T21:30:00Z',
    };

    expect(() => validateAgentMessage(invalidMessage)).toThrow(
      'AgentMessage must have a payload field'
    );
  });

  it('should throw when timestamp is missing', () => {
    const invalidMessage = {
      from: 'agent-123',
      to: 'agent-456',
      type: 'task',
      payload: {},
    };

    expect(() => validateAgentMessage(invalidMessage)).toThrow(
      'AgentMessage must have a non-empty timestamp field'
    );
  });

  it('should throw when timestamp is empty string', () => {
    const invalidMessage = {
      from: 'agent-123',
      to: 'agent-456',
      type: 'task',
      payload: {},
      timestamp: '   ',
    };

    expect(() => validateAgentMessage(invalidMessage)).toThrow(
      'AgentMessage must have a non-empty timestamp field'
    );
  });

  it('should throw when message is not an object', () => {
    expect(() => validateAgentMessage('not-an-object')).toThrow(
      'AgentMessage must be an object'
    );
  });

  it('should throw when message is null', () => {
    expect(() => validateAgentMessage(null)).toThrow('AgentMessage must be an object');
  });
});
