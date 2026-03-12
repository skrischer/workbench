// src/multi-agent/orchestrator.ts — Multi-Agent Orchestrator

import type { AgentRegistry } from './agent-registry.js';
import type { MessageBus } from './message-bus.js';
import type { AnthropicClient } from '../llm/anthropic-client.js';
import type { SessionStorage } from '../storage/session-storage.js';
import type { ToolRegistry } from '../tools/registry.js';
import { AgentLoop } from '../runtime/agent-loop.js';

/**
 * AgentOrchestrator — Runs spawned agents in their own AgentLoop.
 *
 * Called automatically after spawn_agent tool execution.
 * Manages agent lifecycle: status updates, result reporting via MessageBus.
 */
export class AgentOrchestrator {
  private registry: AgentRegistry;
  private messageBus: MessageBus;
  private anthropicClient: AnthropicClient;
  private sessionStorage: SessionStorage;
  private toolRegistry: ToolRegistry;

  constructor(
    registry: AgentRegistry,
    messageBus: MessageBus,
    anthropicClient: AnthropicClient,
    sessionStorage: SessionStorage,
    toolRegistry: ToolRegistry
  ) {
    this.registry = registry;
    this.messageBus = messageBus;
    this.anthropicClient = anthropicClient;
    this.sessionStorage = sessionStorage;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Run a spawned agent in its own AgentLoop.
   * @param agentId - ID of the agent to run
   * @returns Promise that resolves when agent completes
   */
  async runAgent(agentId: string): Promise<void> {
    const agent = this.registry.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    try {
      this.registry.onStatusChange(agentId, 'running');

      const prompt = await this.waitForTaskAssignment(agentId);

      const agentLoop = new AgentLoop(
        this.anthropicClient,
        this.sessionStorage,
        this.toolRegistry,
        agent.config,
        undefined, // eventBus
        undefined, // hooks
        agent.id // agentId
      );

      const result = await agentLoop.run(prompt);

      const status = result.status === 'failed' ? 'failed' : 'completed';
      this.registry.onStatusChange(agentId, status);

      if (agent.parentId) {
        this.messageBus.send(agentId, agent.parentId, 'result', {
          agentId,
          status,
          result: result.finalResponse,
          tokenUsage: result.tokenUsage,
          steps: result.steps,
        });
      }
    } catch (error) {
      this.registry.onStatusChange(agentId, 'failed');

      if (agent.parentId) {
        this.messageBus.send(agentId, agent.parentId, 'error', {
          agentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  }

  /**
   * Wait for a task assignment message from parent or return a default prompt.
   */
  private async waitForTaskAssignment(agentId: string): Promise<string> {
    const agent = this.registry.get(agentId);
    return agent?.config.systemPrompt || 'You are a worker agent. Await instructions.';
  }
}
