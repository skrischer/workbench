// src/tools/list-agents.ts — List Agents Tool
import { BaseTool } from './base.js';
/**
 * Tool for listing agents in the registry with optional filtering.
 */
export class ListAgentsTool extends BaseTool {
    name = 'list_agents';
    description = 'List all agents in the registry. Supports optional filtering by role and/or status.';
    inputSchema = {
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
    registry;
    /**
     * Creates a ListAgentsTool instance.
     * @param registry - AgentRegistry instance for querying agents
     */
    constructor(registry) {
        super();
        this.registry = registry;
    }
    async execute(input) {
        try {
            // Build filter from input
            const filter = {};
            if (input.role) {
                filter.role = input.role;
            }
            if (input.status) {
                filter.status = input.status;
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
        }
        catch (err) {
            const error = err;
            return {
                success: false,
                output: '',
                error: `Failed to list agents: ${error.message}`,
            };
        }
    }
}
