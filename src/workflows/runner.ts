// src/workflows/runner.ts — Workflow Runner with AgentLoop Integration

import type { WorkflowDefinition, WorkflowResult } from '../types/workflow.js';
import type { AgentConfig, RunResult } from '../types/index.js';
import type { AnthropicClient } from '../llm/anthropic-client.js';
import type { SessionStorage } from '../storage/session-storage.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { TypedEventBus } from '../events/event-bus.js';
import { AgentLoop } from '../runtime/agent-loop.js';
import { DEFAULT_MODEL } from '../config/index.js';

/**
 * WorkflowRunner executes a single workflow with the AgentLoop runtime.
 * 
 * This runner integrates the workflow definition with the agent runtime:
 * - Creates a session for the workflow execution
 * - Configures the agent with workflow-specific system prompt and tool whitelist
 * - Runs the agent loop
 * - Emits workflow lifecycle events
 */
export class WorkflowRunner {
  constructor(
    private workflowDefinition: WorkflowDefinition,
    private anthropicClient: AnthropicClient,
    private sessionStorage: SessionStorage,
    private toolRegistry: ToolRegistry,
    private eventBus?: TypedEventBus
  ) {}

  /**
   * Run the workflow with the given input parameters.
   * 
   * @param input - Input parameters for the workflow
   * @returns Promise resolving to WorkflowResult
   */
  async run(input: Record<string, any>): Promise<WorkflowResult> {
    const startTime = performance.now();

    // 1. Validate input
    const validationError = this.workflowDefinition.validateInput(input);
    if (validationError) {
      return {
        workflowId: this.workflowDefinition.id,
        status: 'failed',
        output: `Input validation failed: ${validationError}`,
        filesModified: [],
        tokenUsage: {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheReadTokens: 0,
          totalCacheWriteTokens: 0,
          totalTokens: 0,
          stepCount: 0,
        },
        durationMs: 0,
      };
    }

    // 2. Build workflow-specific system prompt
    const systemPrompt = this.buildSystemPrompt(input);

    // 3. Configure AgentLoop with workflow definition
    const agentConfig: AgentConfig = {
      model: DEFAULT_MODEL,
      systemPrompt,
      maxSteps: this.workflowDefinition.defaultMaxSteps,
      tools: this.workflowDefinition.tools, // Tool whitelist!
    };

    // 4. Create session
    const session = await this.sessionStorage.create(`workflow-${this.workflowDefinition.id}`);

    // 5. Emit workflow:start event
    this.eventBus?.emit('workflow:start', {
      workflowId: this.workflowDefinition.id,
      sessionId: session.id,
      input,
    });

    try {
      // 6. Create and run AgentLoop
      const loop = new AgentLoop(
        this.anthropicClient,
        this.sessionStorage,
        this.toolRegistry,
        agentConfig,
        this.eventBus
      );

      const runResult = await loop.run(this.buildPrompt(input));

      // 7. Emit workflow:end event
      const durationMs = performance.now() - startTime;
      this.eventBus?.emit('workflow:end', {
        workflowId: this.workflowDefinition.id,
        sessionId: session.id,
        status: runResult.status === 'completed' ? 'completed' : 'failed',
        durationMs,
      });

      // 8. Build WorkflowResult
      return {
        workflowId: this.workflowDefinition.id,
        status: runResult.status === 'completed' ? 'completed' : 'failed',
        output: runResult.finalResponse,
        filesModified: this.extractFilesModified(session.id),
        tokenUsage: {
          totalInputTokens: runResult.tokenUsage.input_tokens,
          totalOutputTokens: runResult.tokenUsage.output_tokens,
          totalCacheReadTokens: 0,
          totalCacheWriteTokens: 0,
          totalTokens: runResult.tokenUsage.input_tokens + runResult.tokenUsage.output_tokens,
          stepCount: runResult.steps,
        },
        durationMs,
      };
    } catch (error) {
      const durationMs = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Emit workflow:end event with failed status
      this.eventBus?.emit('workflow:end', {
        workflowId: this.workflowDefinition.id,
        sessionId: session.id,
        status: 'failed',
        durationMs,
      });

      return {
        workflowId: this.workflowDefinition.id,
        status: 'failed',
        output: `Workflow execution failed: ${errorMessage}`,
        filesModified: [],
        tokenUsage: {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheReadTokens: 0,
          totalCacheWriteTokens: 0,
          totalTokens: 0,
          stepCount: 0,
        },
        durationMs,
      };
    }
  }

  /**
   * Build workflow-specific system prompt with input context
   */
  private buildSystemPrompt(input: Record<string, any>): string {
    let prompt = this.workflowDefinition.systemPrompt || '';

    // Add input context as JSON
    prompt += '\n\nInput Context:\n' + JSON.stringify(input, null, 2);

    return prompt;
  }

  /**
   * Build initial user prompt from input
   */
  private buildPrompt(input: Record<string, any>): string {
    // Use workflow's default prompt or build from input
    if (this.workflowDefinition.systemPrompt) {
      // If workflow has a system prompt, just pass the input as JSON
      return JSON.stringify(input, null, 2);
    }
    return JSON.stringify(input);
  }

  /**
   * Extract list of modified files from session (optional implementation)
   */
  private extractFilesModified(sessionId: string): string[] {
    // TODO: Parse tool results to extract file paths
    // For MVP, return empty array
    return [];
  }
}
