// src/tools/list-agents.ts — List Agents Tool

import { BaseTool } from './base.js';
import type { ToolResult, ToolContext } from '../types/index.js';
import type { AgentRegistry } from '../multi-agent/agent-registry.js';
import type { AgentRole, AgentStatus } from '../types/agent.js';

/**
 * Tool for listing agents in the registry with optional filtering.
 */
export class ListAgentsTool extends BaseTool {
  readonly name = 'list_agents';
  readonly description = 'List all agents in the registry. Supports optional filtering by role and/or status.';
  readonly inputSchema = {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        enum: ['planner', 'worker', 'reviewer', 'custom'],
        description: 'Optional: filter by agent role',
      },
      status: {
        type: 'string',
        enum: ['idle', 'running', 'completed', 'failed', 'terminated'],
        description: 'Optional: filter by agent status',
      },
    },
    required: [],
  };

  private registry: AgentRegistry;

  /**
   * Creates a ListAgentsTool instance.
   * @param registry - AgentRegistry instance for querying agents
   */
  constructor(registry: AgentRegistry) {
    super();
    this.registry = registry;
  }

  async execute(input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    try {
      // Build filter from input
      const filter: { role?: AgentRole; status?: AgentStatus } = {};
      if (input.role) {
        filter.role = input.role as AgentRole;
      }
      if (input.status) {
        filter.status = input.status as AgentStatus;
      }

      // Get agents from registry
      const agents = this.registry.list(Object.keys(filter).length > 0 ? filter : undefined);

      // Format output
      if (agents.length === 0) {
        return {
          success: true,
          output: 'No agents found matching the filter criteria.',
          metadata: {
            count: 0,
            filter,
            agents: [],
          },
        };
      }

      const lines = agents.map((agent, idx) => {
        return `${idx + 1}. ${agent.name} (${agent.id.slice(0, 8)})\n` +
               `   Role: ${agent.role}\n` +
               `   Status: ${agent.status}\n` +
               `   Session: ${agent.sessionId.slice(0, 8)}\n` +
               `   Created: ${agent.createdAt}`;
      });

      const output = `Found ${agents.length} agent(s):\n\n${lines.join('\n\n')}`;

      return {
        success: true,
        output,
        metadata: {
          count: agents.length,
          filter,
          agents: agents.map((agent) => ({
            id: agent.id,
            role: agent.role,
            name: agent.name,
            status: agent.status,
            sessionId: agent.sessionId,
            createdAt: agent.createdAt,
          })),
        },
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: '',
        error: `Failed to list agents: ${error.message}`,
      };
    }
  }
}
