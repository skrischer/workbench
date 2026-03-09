// src/workflows/chain.ts — Workflow Chain Runner

import type {
  ChainDefinition,
  ChainResult,
  ChainStepResult,
  WorkflowCondition,
  WorkflowResult,
} from '../types/workflow.js';
import type { RunTokenUsage } from '../types/tokens.js';
import type { AnthropicClient } from '../llm/anthropic-client.js';
import type { SessionStorage } from '../storage/session-storage.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { TypedEventBus } from '../events/event-bus.js';
import { WorkflowRegistry } from './registry.js';
import { WorkflowRunner } from './runner.js';

/**
 * WorkflowChain executes a sequence of workflows with output forwarding.
 * 
 * Features:
 * - Sequential execution: Workflow N waits for Workflow N-1
 * - Output forwarding: previousResult.output passed as context parameter
 * - Conditional steps: skip steps based on declarative rules
 * - Error handling: chain stops on error, returns partial result
 * - Event emission: workflow:chain:start and workflow:chain:end events
 */
export class WorkflowChain {
  constructor(
    private workflowRegistry: WorkflowRegistry,
    private anthropicClient: AnthropicClient,
    private sessionStorage: SessionStorage,
    private toolRegistry: ToolRegistry,
    private eventBus?: TypedEventBus
  ) {}

  /**
   * Execute a workflow chain.
   * 
   * @param chainDefinition - Chain definition with steps
   * @returns Promise resolving to ChainResult
   */
  async run(chainDefinition: ChainDefinition): Promise<ChainResult> {
    const startTime = performance.now();
    const stepResults: ChainStepResult[] = [];
    
    // Emit chain:start event
    this.eventBus?.emit('workflow:chain:start', {
      stepCount: chainDefinition.steps.length,
    });

    let previousResult: WorkflowResult | null = null;

    // Execute steps sequentially
    for (let i = 0; i < chainDefinition.steps.length; i++) {
      const step = chainDefinition.steps[i];
      
      // Check condition (if present)
      if (step.condition && previousResult) {
        const shouldSkip = !this.evaluateCondition(step.condition, previousResult);
        
        if (shouldSkip) {
          // Skip this step
          const skipReason = this.explainSkipReason(step.condition, previousResult);
          stepResults.push({
            workflowId: step.workflowId,
            status: 'skipped',
            output: '',
            tokenUsage: this.createEmptyTokenUsage(),
            durationMs: 0,
            skipReason,
          });
          continue;
        }
      }

      // Get workflow definition
      const definition = this.workflowRegistry.get(step.workflowId);
      if (!definition) {
        // Workflow not found - treat as error
        const errorResult = this.createErrorStepResult(
          step.workflowId,
          `Workflow '${step.workflowId}' not found in registry`
        );
        stepResults.push(errorResult);
        
        // Stop chain on error
        const totalDurationMs = performance.now() - startTime;
        this.emitChainEnd('failed', totalDurationMs);
        
        return {
          status: 'failed',
          steps: stepResults,
          totalTokenUsage: this.aggregateTokenUsage(stepResults),
          totalDurationMs,
        };
      }

      // Build params with context from previous result
      const params = this.buildParamsWithContext(step.params, previousResult);

      // Create runner and execute
      const runner = new WorkflowRunner(
        definition,
        this.anthropicClient,
        this.sessionStorage,
        this.toolRegistry,
        this.eventBus
      );

      const stepStartTime = performance.now();
      
      try {
        const result = await runner.run(params);
        previousResult = result;

        // Convert WorkflowResult to ChainStepResult
        const stepResult: ChainStepResult = {
          workflowId: result.workflowId,
          status: result.status === 'completed' ? 'completed' : 'failed',
          output: result.output,
          tokenUsage: result.tokenUsage,
          durationMs: result.durationMs,
        };

        stepResults.push(stepResult);

        // Stop chain if step failed
        if (result.status === 'failed') {
          const totalDurationMs = performance.now() - startTime;
          this.emitChainEnd('partial', totalDurationMs);
          
          return {
            status: 'partial',
            steps: stepResults,
            totalTokenUsage: this.aggregateTokenUsage(stepResults),
            totalDurationMs,
          };
        }
      } catch (error) {
        // Handle unexpected errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorResult = this.createErrorStepResult(step.workflowId, errorMessage);
        stepResults.push(errorResult);

        // Stop chain on error
        const totalDurationMs = performance.now() - startTime;
        this.emitChainEnd('failed', totalDurationMs);
        
        return {
          status: 'failed',
          steps: stepResults,
          totalTokenUsage: this.aggregateTokenUsage(stepResults),
          totalDurationMs,
        };
      }
    }

    // All steps completed successfully
    const totalDurationMs = performance.now() - startTime;
    this.emitChainEnd('completed', totalDurationMs);

    return {
      status: 'completed',
      steps: stepResults,
      totalTokenUsage: this.aggregateTokenUsage(stepResults),
      totalDurationMs,
    };
  }

  /**
   * Evaluate a condition against a workflow result.
   * Returns true if condition matches (step should run).
   */
  private evaluateCondition(
    condition: WorkflowCondition,
    result: WorkflowResult
  ): boolean {
    // Check status condition
    if (condition.status !== undefined) {
      if (result.status !== condition.status) {
        return false;
      }
    }

    // Check tokenUsage condition
    if (condition.tokenUsage !== undefined) {
      const totalTokens = result.tokenUsage.totalTokens;
      
      if (condition.tokenUsage.$lt !== undefined && totalTokens >= condition.tokenUsage.$lt) {
        return false;
      }
      
      if (condition.tokenUsage.$gt !== undefined && totalTokens <= condition.tokenUsage.$gt) {
        return false;
      }
    }

    // Check outputContains condition
    if (condition.outputContains !== undefined) {
      if (!result.output.includes(condition.outputContains)) {
        return false;
      }
    }

    // All conditions match
    return true;
  }

  /**
   * Explain why a step was skipped (for debugging).
   */
  private explainSkipReason(
    condition: WorkflowCondition,
    result: WorkflowResult
  ): string {
    const reasons: string[] = [];

    if (condition.status !== undefined && result.status !== condition.status) {
      reasons.push(`status was '${result.status}' (expected '${condition.status}')`);
    }

    if (condition.tokenUsage !== undefined) {
      const totalTokens = result.tokenUsage.totalTokens;
      
      if (condition.tokenUsage.$lt !== undefined && totalTokens >= condition.tokenUsage.$lt) {
        reasons.push(`tokenUsage was ${totalTokens} (expected < ${condition.tokenUsage.$lt})`);
      }
      
      if (condition.tokenUsage.$gt !== undefined && totalTokens <= condition.tokenUsage.$gt) {
        reasons.push(`tokenUsage was ${totalTokens} (expected > ${condition.tokenUsage.$gt})`);
      }
    }

    if (condition.outputContains !== undefined) {
      if (!result.output.includes(condition.outputContains)) {
        reasons.push(`output did not contain '${condition.outputContains}'`);
      }
    }

    return reasons.join(', ');
  }

  /**
   * Build params with context from previous result.
   * Merges step.params with { context: previousResult.output }
   */
  private buildParamsWithContext(
    params: Record<string, unknown>,
    previousResult: WorkflowResult | null
  ): Record<string, unknown> {
    if (!previousResult) {
      return params;
    }

    // Merge params with context
    return {
      ...params,
      context: previousResult.output,
    };
  }

  /**
   * Create an empty token usage object.
   */
  private createEmptyTokenUsage(): RunTokenUsage {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: 0,
      stepCount: 0,
    };
  }

  /**
   * Create an error step result.
   */
  private createErrorStepResult(
    workflowId: string,
    errorMessage: string
  ): ChainStepResult {
    return {
      workflowId,
      status: 'failed',
      output: `Error: ${errorMessage}`,
      tokenUsage: this.createEmptyTokenUsage(),
      durationMs: 0,
    };
  }

  /**
   * Aggregate token usage across all steps.
   */
  private aggregateTokenUsage(steps: ChainStepResult[]): RunTokenUsage {
    return steps.reduce(
      (acc, step) => ({
        totalInputTokens: acc.totalInputTokens + step.tokenUsage.totalInputTokens,
        totalOutputTokens: acc.totalOutputTokens + step.tokenUsage.totalOutputTokens,
        totalCacheReadTokens: acc.totalCacheReadTokens + step.tokenUsage.totalCacheReadTokens,
        totalCacheWriteTokens: acc.totalCacheWriteTokens + step.tokenUsage.totalCacheWriteTokens,
        totalTokens: acc.totalTokens + step.tokenUsage.totalTokens,
        stepCount: acc.stepCount + step.tokenUsage.stepCount,
      }),
      this.createEmptyTokenUsage()
    );
  }

  /**
   * Emit workflow:chain:end event.
   */
  private emitChainEnd(
    status: 'completed' | 'failed' | 'partial',
    durationMs: number
  ): void {
    this.eventBus?.emit('workflow:chain:end', {
      status,
      durationMs,
    });
  }
}
