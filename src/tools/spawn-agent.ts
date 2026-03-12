// src/tools/spawn-agent.ts — Spawn Agent Tool

import { BaseTool } from './base.js';
import type { ToolResult, ToolContext } from '../types/index.js';
import type { AgentRegistry } from '../multi-agent/agent-registry.js';
import type { SpawnConfig } from '../types/agent.js';
import { validateSpawnConfig } from '../multi-agent/validation.js';

/**
 * Tool for spawning new agent instances in the multi-agent system.
 * Enforces privilege checks (no planner role spawning).
 */
export class SpawnAgentTool extends BaseTool {
  readonly name = 'spawn_agent';
  readonly description = 'Spawn a new agent instance with the specified role and configuration. Cannot spawn planner agents (privilege restriction).';
  readonly inputSchema = {
    type: 'object',
    properties: {
      role: {
        type: 'string',
        enum: ['worker', 'reviewer', 'custom'],
        description: 'Agent role (planner role is restricted)',
      },
      name: {
        type: 'string',
        description: 'Optional custom agent name (defaults to role-based name)',
      },
      model: {
        type: 'string',
        description: 'Optional model override (defaults to parent model)',
      },
      systemPrompt: {
        type: 'string',
        description: 'Optional custom system prompt',
      },
      tools: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tool whitelist for this agent',
      },
      maxSteps: {
        type: 'number',
        description: 'Optional maximum execution steps (must be > 0)',
      },
      cwd: {
        type: 'string',
        description: 'Optional working directory for agent',
      },
    },
    required: ['role'],
  };

  private registry: AgentRegistry;

  /**
   * Creates a SpawnAgentTool instance.
   * @param registry - AgentRegistry instance for spawning agents
   */
  constructor(registry: AgentRegistry) {
    super();
    this.registry = registry;
  }

  async execute(input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    try {
      // Extract parent agent ID from context (if available)
      const parentId = context?.agentId;

      // Build config from input
      const config: SpawnConfig = {
        role: input.role as SpawnConfig['role'],
        name: input.name as string | undefined,
        model: input.model as string | undefined,
        systemPrompt: input.systemPrompt as string | undefined,
        tools: input.tools as string[] | undefined,
        maxSteps: input.maxSteps as number | undefined,
        cwd: input.cwd as string | undefined,
        parentId,
      };

      // Privilege check: prevent spawning planner agents
      if (config.role === 'planner') {
        return {
          success: false,
          output: '',
          error: 'Privilege violation: cannot spawn agents with role "planner"',
        };
      }

      // Validate spawn config (throws on error)
      validateSpawnConfig(config);

      // Spawn agent via registry
      const agent = this.registry.spawn(config);

      return {
        success: true,
        output: `Agent spawned successfully: ${agent.name} (${agent.role})`,
        metadata: {
          id: agent.id,
          role: agent.role,
          name: agent.name,
          status: agent.status,
          sessionId: agent.sessionId,
          createdAt: agent.createdAt,
        },
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: '',
        error: `Failed to spawn agent: ${error.message}`,
      };
    }
  }
}
