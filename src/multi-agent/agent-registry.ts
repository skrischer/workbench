// src/multi-agent/agent-registry.ts — Agent Lifecycle Management

import { randomUUID } from 'node:crypto';
import type { AgentInstance, SpawnConfig, AgentRole, AgentStatus } from '../types/agent.js';
import { eventBus } from '../events/event-bus.js';
import { validateSpawnConfig } from './validation.js';

/**
 * AgentRegistry — Manages agent lifecycle (spawn, terminate, query, events).
 * 
 * Features:
 * - Spawn agents with unique IDs and session tracking
 * - Terminate agents with cleanup
 * - Query agents by ID, role, or status
 * - Emit lifecycle events via EventBus
 * - Enforce configurable agent limit
 */
export class AgentRegistry {
  private agents: Map<string, AgentInstance> = new Map();
  private maxAgents: number;

  /**
   * Create a new AgentRegistry.
   * @param maxAgents - Maximum number of concurrent agents (default: 10)
   */
  constructor(maxAgents = 10) {
    if (!Number.isInteger(maxAgents) || maxAgents <= 0) {
      throw new Error('maxAgents must be a positive integer');
    }
    this.maxAgents = maxAgents;
  }

  /**
   * Spawn a new agent instance.
   * @param config - Agent spawn configuration
   * @returns The created AgentInstance
   * @throws Error if max agent limit is reached or config is invalid
   */
  spawn(config: SpawnConfig): AgentInstance {
    // Validate configuration
    validateSpawnConfig(config);

    // Check agent limit
    if (this.agents.size >= this.maxAgents) {
      throw new Error(`Max agent limit reached (${this.maxAgents})`);
    }

    // Generate unique IDs
    const id = randomUUID();
    const sessionId = randomUUID();

    // Create agent instance
    const agent: AgentInstance = {
      id,
      role: config.role,
      name: config.name || `${config.role}-${id.slice(0, 8)}`,
      status: 'idle',
      config: {
        model: config.model || 'claude-sonnet-4',
        systemPrompt: config.systemPrompt || '',
        tools: config.tools,
        maxSteps: config.maxSteps || 10,
      },
      sessionId,
      createdAt: new Date().toISOString(),
      metadata: {},
    };

    // Store agent
    this.agents.set(id, agent);

    // Emit spawn event
    eventBus.emit('agent:spawned', {
      id: agent.id,
      role: agent.role,
      sessionId: agent.sessionId,
    });

    return agent;
  }

  /**
   * Terminate an agent and clean up resources.
   * @param id - Agent ID to terminate
   * @throws Error if agent not found
   */
  terminate(id: string): void {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent not found: ${id}`);
    }

    // Update status
    agent.status = 'terminated';

    // Emit terminate event
    eventBus.emit('agent:terminated', {
      id: agent.id,
      role: agent.role,
    });

    // Remove from registry
    this.agents.delete(id);
  }

  /**
   * Get an agent by ID.
   * @param id - Agent ID
   * @returns AgentInstance or undefined if not found
   */
  get(id: string): AgentInstance | undefined {
    return this.agents.get(id);
  }

  /**
   * List agents with optional filtering.
   * @param filter - Optional filter criteria
   * @returns Array of matching AgentInstances
   */
  list(filter?: { role?: AgentRole; status?: AgentStatus }): AgentInstance[] {
    const agents = Array.from(this.agents.values());

    if (!filter) {
      return agents;
    }

    return agents.filter((agent) => {
      if (filter.role && agent.role !== filter.role) {
        return false;
      }
      if (filter.status && agent.status !== filter.status) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get all agents with a specific role.
   * @param role - Agent role to filter by
   * @returns Array of AgentInstances with the specified role
   */
  getByRole(role: AgentRole): AgentInstance[] {
    return this.list({ role });
  }

  /**
   * Update an agent's status and emit status event.
   * @param id - Agent ID
   * @param status - New status
   * @throws Error if agent not found
   */
  onStatusChange(id: string, status: AgentStatus): void {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error(`Agent not found: ${id}`);
    }

    const previousStatus = agent.status;
    agent.status = status;

    // Emit status change event
    eventBus.emit('agent:status', {
      id: agent.id,
      status: agent.status,
      previousStatus,
    });
  }

  /**
   * Get the current number of active agents.
   * @returns Number of agents in the registry
   */
  get count(): number {
    return this.agents.size;
  }

  /**
   * Clear all agents (for testing/cleanup).
   */
  clear(): void {
    this.agents.clear();
  }
}
