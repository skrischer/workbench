// src/multi-agent/orchestrator.ts — Planner-Worker Pattern for Multi-Agent Coordination

import type { AgentRegistry } from './agent-registry.js';
import type { MessageBus } from './message-bus.js';
import type { Plan, Step, StepResult, PlanStatus } from '../types/task.js';
import type { AgentInstance } from '../types/agent.js';
import type { AnthropicClient } from '../llm/anthropic-client.js';
import type { SessionStorage } from '../storage/session-storage.js';
import type { ToolRegistry } from '../tools/registry.js';
import { AgentLoop } from '../runtime/agent-loop.js';

export interface OrchestratorOptions {
  /** Maximum number of concurrent worker agents (default: 5) */
  maxWorkers?: number;
  /** Timeout in milliseconds for step execution (default: 60000) */
  stepTimeoutMs?: number;
  /** Model to use for worker agents (defaults to planner's model) */
  workerModel?: string;
}

export interface PlanExecutionResult {
  planId: string;
  status: PlanStatus;
  completedSteps: number;
  totalSteps: number;
  results: Map<string, StepResult>;
  errors: Array<{ stepId: string; error: string }>;
  durationMs: number;
}

/**
 * AgentOrchestrator — Executes plans using a planner-worker pattern.
 * 
 * Features:
 * - Analyzes step dependencies (dependsOn) for parallel execution
 * - Spawns worker agents for concurrent step execution
 * - Assigns steps via MessageBus
 * - Collects results and updates plan status
 * - Handles failures and worker cleanup
 * - Runs spawned agents in their own AgentLoop
 */
export class AgentOrchestrator {
  private registry: AgentRegistry;
  private messageBus: MessageBus;
  private anthropicClient: AnthropicClient;
  private sessionStorage: SessionStorage;
  private toolRegistry: ToolRegistry;
  private workers: Set<string> = new Set();
  private stepResults: Map<string, StepResult> = new Map();
  private stepErrors: Array<{ stepId: string; error: string }> = [];

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
   * This is called automatically after spawn_agent tool execution.
   * @param agentId - ID of the agent to run
   * @returns Promise that resolves when agent completes
   */
  async runAgent(agentId: string): Promise<void> {
    // 1. Get agent from registry
    const agent = this.registry.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    try {
      // 2. Set status to running
      this.registry.onStatusChange(agentId, 'running');

      // 3. Wait for task assignment via MessageBus
      // In a real implementation, this would wait for a 'task' message
      // For now, we'll use a simple default prompt
      const prompt = await this.waitForTaskAssignment(agentId);

      // 4. Create AgentLoop for this agent (with recursive orchestrator reference)
      const agentLoop = new AgentLoop(
        this.anthropicClient,
        this.sessionStorage,
        this.toolRegistry,
        agent.config,
        undefined, // eventBus
        undefined, // hooks
        agent.id // agentId
      );

      // 5. Run the agent
      const result = await agentLoop.run(prompt);

      // 6. Update status based on result
      const status = result.status === 'failed' ? 'failed' : 'completed';
      this.registry.onStatusChange(agentId, status);

      // 7. Send completion message to parent (if exists)
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
      // Mark as failed and send error to parent
      this.registry.onStatusChange(agentId, 'failed');

      if (agent.parentId) {
        this.messageBus.send(agentId, agent.parentId, 'error', {
          agentId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Re-throw for logging
      throw error;
    }
  }

  /**
   * Wait for a task assignment message from parent or return a default prompt.
   * @param agentId - Agent ID waiting for task
   * @returns Task prompt
   */
  private async waitForTaskAssignment(agentId: string): Promise<string> {
    // For MVP, we'll use a simple default prompt
    // In a full implementation, this would listen to MessageBus for 'task' messages
    const agent = this.registry.get(agentId);
    return agent?.config.systemPrompt || 'You are a worker agent. Await instructions.';
  }

  /**
   * Execute a plan using worker agents.
   * @param plan - Plan to execute
   * @param options - Orchestrator options
   * @returns Execution result with status and collected results
   */
  async executePlan(
    plan: Plan,
    options?: OrchestratorOptions
  ): Promise<PlanExecutionResult> {
    const startTime = Date.now();
    const maxWorkers = options?.maxWorkers ?? 5;
    const stepTimeoutMs = options?.stepTimeoutMs ?? 60000;

    // Reset state
    this.stepResults.clear();
    this.stepErrors = [];
    this.workers.clear();

    // Set plan status to running
    plan.status = 'running';

    try {
      // Group steps by execution level (based on dependencies)
      const executionGroups = this.groupStepsByDependencies(plan.steps);

      // Execute each group
      for (const group of executionGroups) {
        const groupSuccess = await this.executeStepGroup(
          plan,
          group,
          maxWorkers,
          stepTimeoutMs,
          options?.workerModel
        );

        // If group failed, stop execution
        if (!groupSuccess) {
          plan.status = 'paused';
          break;
        }
      }

      // If all groups completed successfully, mark plan as completed
      if (plan.status === 'running') {
        plan.status = 'completed';
      }
    } catch (error) {
      plan.status = 'failed';
      this.stepErrors.push({
        stepId: 'unknown',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Always terminate workers
      this.terminateWorkers();
    }

    // Collect and return results
    return this.collectResults(plan, startTime);
  }

  /**
   * Assign a step to a worker agent via MessageBus.
   * @param agentId - Worker agent ID
   * @param step - Step to assign
   */
  async assignStep(agentId: string, step: Step): Promise<void> {
    // Update step status
    step.status = 'running';

    // Send task message via MessageBus
    this.messageBus.send('orchestrator', agentId, 'task', {
      stepId: step.id,
      prompt: step.prompt,
      toolHints: step.toolHints,
      maxSteps: step.maxSteps,
    });
  }

  /**
   * Collect results from all steps.
   * @param plan - Executed plan
   * @param startTime - Execution start timestamp
   * @returns Plan execution result
   */
  collectResults(plan: Plan, startTime?: number): PlanExecutionResult {
    const completedSteps = plan.steps.filter(
      (step) => step.status === 'completed'
    ).length;

    return {
      planId: plan.id,
      status: plan.status,
      completedSteps,
      totalSteps: plan.steps.length,
      results: new Map(this.stepResults),
      errors: [...this.stepErrors],
      durationMs: startTime ? Date.now() - startTime : 0,
    };
  }

  /**
   * Terminate all worker agents.
   */
  terminateWorkers(): void {
    for (const workerId of this.workers) {
      try {
        this.registry.terminate(workerId);
      } catch (error) {
        // Ignore errors during cleanup
        console.error(`Failed to terminate worker ${workerId}:`, error);
      }
    }
    this.workers.clear();
  }

  /**
   * Group steps by dependency levels for parallel execution.
   * Steps without dependencies can run in parallel.
   * Steps with dependencies must wait for their dependencies to complete.
   * @param steps - All plan steps
   * @returns Array of step groups (each group can be executed in parallel)
   */
  private groupStepsByDependencies(steps: Step[]): Step[][] {
    const groups: Step[][] = [];
    const completed = new Set<string>();
    const remaining = [...steps];

    while (remaining.length > 0) {
      // Find steps whose dependencies are all completed
      const readySteps = remaining.filter((step) => {
        if (!step.dependsOn || step.dependsOn.length === 0) {
          return true;
        }
        return step.dependsOn.every((depId) => completed.has(depId));
      });

      // If no steps are ready, we have a circular dependency or missing step
      if (readySteps.length === 0) {
        throw new Error(
          `Circular dependency detected or missing step reference in: ${remaining.map((s) => s.id).join(', ')}`
        );
      }

      // Add ready steps to current group
      groups.push(readySteps);

      // Mark steps as completed
      for (const step of readySteps) {
        completed.add(step.id);
      }

      // Remove ready steps from remaining
      for (const step of readySteps) {
        const index = remaining.indexOf(step);
        if (index !== -1) {
          remaining.splice(index, 1);
        }
      }
    }

    return groups;
  }

  /**
   * Execute a group of steps in parallel (up to maxWorkers).
   * @param plan - The plan being executed
   * @param steps - Steps to execute in this group
   * @param maxWorkers - Maximum concurrent workers
   * @param stepTimeoutMs - Timeout for each step
   * @param workerModel - Optional model for workers
   * @returns True if all steps completed successfully, false otherwise
   */
  private async executeStepGroup(
    plan: Plan,
    steps: Step[],
    maxWorkers: number,
    stepTimeoutMs: number,
    workerModel?: string
  ): Promise<boolean> {
    // Spawn workers (up to maxWorkers)
    const workerCount = Math.min(steps.length, maxWorkers);
    const workers: AgentInstance[] = [];

    for (let i = 0; i < workerCount; i++) {
      const worker = this.registry.spawn({
        role: 'worker',
        name: `worker-${i}`,
        model: workerModel,
      });
      workers.push(worker);
      this.workers.add(worker.id);
    }

    // Create a promise for each step execution
    const stepPromises = steps.map((step, index) => {
      return this.executeStepWithWorker(
        step,
        workers[index % workerCount],
        stepTimeoutMs
      );
    });

    // Wait for all steps to complete
    const results = await Promise.allSettled(stepPromises);

    // Process results
    let allSuccess = true;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const step = steps[i];

      if (result.status === 'fulfilled' && result.value) {
        // Step completed successfully
        step.status = 'completed';
        step.result = result.value;
        this.stepResults.set(step.id, result.value);
      } else {
        // Step failed
        step.status = 'failed';
        const error =
          result.status === 'rejected'
            ? result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
            : 'Unknown error';

        this.stepErrors.push({ stepId: step.id, error });
        allSuccess = false;
      }
    }

    return allSuccess;
  }

  /**
   * Execute a single step with a worker agent.
   * This simulates the worker execution flow via MessageBus.
   * In a real implementation, this would involve actual agent execution.
   * @param step - Step to execute
   * @param worker - Worker agent to execute the step
   * @param timeoutMs - Timeout in milliseconds
   * @returns Step result or null on failure
   */
  private async executeStepWithWorker(
    step: Step,
    worker: AgentInstance,
    timeoutMs: number
  ): Promise<StepResult | null> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      // Register message handler for worker responses
      const unsubscribe = this.messageBus.onMessage(
        'orchestrator',
        (message) => {
          // Only process messages from this worker about this step
          if (message.from === worker.id && message.type === 'result') {
            const payload = message.payload as {
              stepId: string;
              result?: StepResult;
              error?: string;
            };

            if (payload.stepId === step.id) {
              // Clear timeout
              if (timeoutId) {
                clearTimeout(timeoutId);
              }

              // Unsubscribe from messages
              unsubscribe();

              // Resolve or reject based on result
              if (payload.error) {
                reject(new Error(payload.error));
              } else if (payload.result) {
                resolve(payload.result);
              } else {
                reject(new Error('No result or error in response'));
              }
            }
          }
        }
      );

      // Set timeout
      timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Step ${step.id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Assign step to worker
      this.assignStep(worker.id, step).catch((error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        unsubscribe();
        reject(error);
      });
    });
  }
}
