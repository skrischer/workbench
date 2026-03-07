// src/task/plan-executor.ts — Step-by-Step Plan Execution

import type { TypedEventBus } from '../events/event-bus.js';
import type { EventMap } from '../types/events.js';
import type { RunTokenUsage } from '../types/tokens.js';
import type { Plan, Step, StepResult } from '../types/task.js';
import type { PlanStorage } from './plan-storage.js';

/**
 * StepRunner function type - executes a single step and returns result
 */
export type StepRunner = (step: Step) => Promise<StepResult>;

/**
 * Configuration for PlanExecutor
 */
export interface PlanExecutorConfig {
  planStorage: PlanStorage;
  eventBus: TypedEventBus<EventMap>;
  stepRunner: StepRunner;
}

/**
 * PlanExecutor — Executes plans step-by-step with crash recovery
 * 
 * Features:
 * - Linear execution: Step 1 → Step 2 → ... → Step N
 * - Persists after each step (crash recovery)
 * - Pause/Resume support
 * - Event emission for monitoring
 * - Token usage tracking
 */
export class PlanExecutor {
  private planStorage: PlanStorage;
  private eventBus: TypedEventBus<EventMap>;
  private stepRunner: StepRunner;
  private paused = false;

  constructor(config: PlanExecutorConfig) {
    this.planStorage = config.planStorage;
    this.eventBus = config.eventBus;
    this.stepRunner = config.stepRunner;
  }

  /**
   * Execute a plan from the beginning
   * @param planId - The plan ID to execute
   * @throws Error if plan not found or already running
   */
  async execute(planId: string): Promise<void> {
    const plan = await this.planStorage.load(planId);

    // Check if plan can be executed
    if (plan.status === 'running') {
      throw new Error(`Plan is already running: ${planId}`);
    }
    if (plan.status === 'completed') {
      throw new Error(`Plan is already completed: ${planId}`);
    }

    // Reset pause flag
    this.paused = false;

    // Start from beginning
    plan.currentStepIndex = 0;
    plan.status = 'running';
    await this.planStorage.save(plan);

    // Execute the plan
    await this.executePlan(plan);
  }

  /**
   * Resume a paused or failed plan from current step index
   * @param planId - The plan ID to resume
   * @throws Error if plan not found or cannot be resumed
   */
  async resume(planId: string): Promise<void> {
    const plan = await this.planStorage.load(planId);

    // Check if plan can be resumed
    if (plan.status === 'completed') {
      throw new Error(`Plan is already completed: ${planId}`);
    }
    if (plan.status === 'running') {
      throw new Error(`Plan is already running: ${planId}`);
    }

    // Reset pause flag
    this.paused = false;

    // Resume from current step index
    plan.status = 'running';
    await this.planStorage.save(plan);

    // Execute the plan
    await this.executePlan(plan);
  }

  /**
   * Pause execution after the current step completes
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Internal method to execute plan steps
   */
  private async executePlan(plan: Plan): Promise<void> {
    // Emit plan:start event
    this.eventBus.emit('plan:start', {
      planId: plan.id,
      title: plan.title,
      stepCount: plan.steps.length,
    });

    // Execute steps from currentStepIndex to end
    for (let i = plan.currentStepIndex; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      // Update step status to running
      step.status = 'running';
      await this.planStorage.save(plan);

      // Emit step:start event
      this.eventBus.emit('plan:step:start', {
        planId: plan.id,
        stepId: step.id,
        stepIndex: i,
        stepTitle: step.title,
      });

      const stepStartTime = Date.now();

      try {
        // Execute the step
        const result = await this.stepRunner(step);

        // Update step with result
        step.result = result;
        step.status = result.error ? 'failed' : 'completed';

        // Calculate duration
        const durationMs = Date.now() - stepStartTime;

        // Emit step:end event
        this.eventBus.emit('plan:step:end', {
          planId: plan.id,
          stepId: step.id,
          stepIndex: i,
          status: step.status,
          durationMs,
        });

        // If step failed, mark plan as failed and stop
        if (result.error) {
          plan.status = 'failed';
          plan.currentStepIndex = i;
          this.calculateAndSaveTotalTokenUsage(plan);
          await this.planStorage.save(plan);

          // Emit plan:end event
          this.emitPlanEndEvent(plan);
          return;
        }

        // Step completed successfully
        plan.currentStepIndex = i + 1;
        await this.planStorage.save(plan);

        // Check if paused
        if (this.paused) {
          plan.status = 'paused';
          await this.planStorage.save(plan);

          // Emit plan:end event
          this.emitPlanEndEvent(plan);
          return;
        }
      } catch (error) {
        // Unexpected error during step execution
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        step.result = {
          output: '',
          tokenUsage: {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCacheReadTokens: 0,
            totalCacheWriteTokens: 0,
            totalTokens: 0,
            stepCount: 0,
          },
          filesModified: [],
          durationMs: Date.now() - stepStartTime,
          error: errorMessage,
        };
        step.status = 'failed';
        plan.status = 'failed';
        plan.currentStepIndex = i;

        this.calculateAndSaveTotalTokenUsage(plan);
        await this.planStorage.save(plan);

        // Emit step:end event
        this.eventBus.emit('plan:step:end', {
          planId: plan.id,
          stepId: step.id,
          stepIndex: i,
          status: 'failed',
          durationMs: Date.now() - stepStartTime,
        });

        // Emit plan:end event
        this.emitPlanEndEvent(plan);
        return;
      }
    }

    // All steps completed successfully
    plan.status = 'completed';
    this.calculateAndSaveTotalTokenUsage(plan);
    await this.planStorage.save(plan);

    // Emit plan:end event
    this.emitPlanEndEvent(plan);
  }

  /**
   * Calculate total token usage across all completed steps
   */
  private calculateAndSaveTotalTokenUsage(plan: Plan): void {
    const totalTokenUsage: RunTokenUsage = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      totalTokens: 0,
      stepCount: 0,
    };

    for (const step of plan.steps) {
      if (step.result?.tokenUsage) {
        const usage = step.result.tokenUsage;
        totalTokenUsage.totalInputTokens += usage.totalInputTokens;
        totalTokenUsage.totalOutputTokens += usage.totalOutputTokens;
        totalTokenUsage.totalCacheReadTokens += usage.totalCacheReadTokens;
        totalTokenUsage.totalCacheWriteTokens += usage.totalCacheWriteTokens;
        totalTokenUsage.totalTokens += usage.totalTokens;
        totalTokenUsage.stepCount += usage.stepCount;
      }
    }

    plan.metadata.totalTokenUsage = totalTokenUsage;
  }

  /**
   * Emit plan:end event with aggregated data
   */
  private emitPlanEndEvent(plan: Plan): void {
    const completedSteps = plan.steps.filter(
      (step) => step.status === 'completed'
    ).length;

    this.eventBus.emit('plan:end', {
      planId: plan.id,
      status: plan.status,
      totalSteps: plan.steps.length,
      completedSteps,
    });
  }
}
