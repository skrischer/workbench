// src/task/validation.ts — Runtime Validation for Task System Types

import type { Plan, Step, StepStatus, PlanStatus } from '../types/task.js';

/** Valid step statuses for runtime validation */
const VALID_STEP_STATUSES: StepStatus[] = ['pending', 'running', 'completed', 'failed', 'skipped'];

/** Valid plan statuses for runtime validation */
const VALID_PLAN_STATUSES: PlanStatus[] = ['pending', 'running', 'completed', 'failed', 'paused'];

/**
 * Validates a Step object
 * @param step - Step to validate
 * @throws Error if step is invalid
 */
export function validateStep(step: unknown): asserts step is Step {
  if (!step || typeof step !== 'object') {
    throw new Error('Step must be an object');
  }

  const s = step as Partial<Step>;

  if (!s.id || typeof s.id !== 'string' || s.id.trim() === '') {
    throw new Error('Step must have a non-empty id');
  }

  if (!s.title || typeof s.title !== 'string' || s.title.trim() === '') {
    throw new Error('Step must have a non-empty title');
  }

  if (!s.prompt || typeof s.prompt !== 'string' || s.prompt.trim() === '') {
    throw new Error('Step must have a non-empty prompt');
  }

  if (!s.status || !VALID_STEP_STATUSES.includes(s.status as StepStatus)) {
    throw new Error(
      `Step status must be one of: ${VALID_STEP_STATUSES.join(', ')} (got: ${s.status})`
    );
  }

  // Optional fields validation
  if (s.dependsOn !== undefined && !Array.isArray(s.dependsOn)) {
    throw new Error('Step dependsOn must be an array if provided');
  }

  if (s.toolHints !== undefined && !Array.isArray(s.toolHints)) {
    throw new Error('Step toolHints must be an array if provided');
  }

  if (s.maxSteps !== undefined && (typeof s.maxSteps !== 'number' || s.maxSteps <= 0)) {
    throw new Error('Step maxSteps must be a positive number if provided');
  }
}

/**
 * Validates a Plan object
 * @param plan - Plan to validate
 * @throws Error if plan is invalid
 */
export function validatePlan(plan: unknown): asserts plan is Plan {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Plan must be an object');
  }

  const p = plan as Partial<Plan>;

  if (!p.id || typeof p.id !== 'string' || p.id.trim() === '') {
    throw new Error('Plan must have a non-empty id');
  }

  if (!p.title || typeof p.title !== 'string' || p.title.trim() === '') {
    throw new Error('Plan must have a non-empty title');
  }

  if (!p.description || typeof p.description !== 'string') {
    throw new Error('Plan must have a description');
  }

  if (!p.status || !VALID_PLAN_STATUSES.includes(p.status as PlanStatus)) {
    throw new Error(
      `Plan status must be one of: ${VALID_PLAN_STATUSES.join(', ')} (got: ${p.status})`
    );
  }

  if (!Array.isArray(p.steps)) {
    throw new Error('Plan must have a steps array');
  }

  if (p.steps.length === 0) {
    throw new Error('Plan must have at least one step');
  }

  // Validate each step
  for (let i = 0; i < p.steps.length; i++) {
    try {
      validateStep(p.steps[i]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid step at index ${i}: ${message}`);
    }
  }

  if (typeof p.currentStepIndex !== 'number' || p.currentStepIndex < 0) {
    throw new Error('Plan currentStepIndex must be a non-negative number');
  }

  if (!p.createdAt || typeof p.createdAt !== 'string') {
    throw new Error('Plan must have a createdAt timestamp');
  }

  if (!p.updatedAt || typeof p.updatedAt !== 'string') {
    throw new Error('Plan must have an updatedAt timestamp');
  }

  if (!p.metadata || typeof p.metadata !== 'object') {
    throw new Error('Plan must have a metadata object');
  }

  const meta = p.metadata as Partial<Plan['metadata']>;

  if (!meta.originalPrompt || typeof meta.originalPrompt !== 'string') {
    throw new Error('Plan metadata must have an originalPrompt');
  }

  if (!meta.model || typeof meta.model !== 'string') {
    throw new Error('Plan metadata must have a model');
  }
}
