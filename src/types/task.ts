// src/types/task.ts — Task System Type Definitions

import type { RunTokenUsage } from './tokens.js';

/** Status of a Plan */
export type PlanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';

/** Status of a Step */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** Result of a completed Step */
export interface StepResult {
  output: string;
  tokenUsage: RunTokenUsage;
  filesModified: string[];
  durationMs: number;
  error?: string;
}

/** Step — atomic execution unit within a Plan */
export interface Step {
  id: string;
  title: string;
  prompt: string;
  status: StepStatus;
  result?: StepResult;
  dependsOn?: string[];
  toolHints?: string[];
  maxSteps?: number;
}

/** Plan — structured execution plan with steps */
export interface Plan {
  id: string;
  title: string;
  description: string;
  status: PlanStatus;
  steps: Step[];
  currentStepIndex: number;
  createdAt: string;
  updatedAt: string;
  metadata: {
    originalPrompt: string;
    model: string;
    totalTokenUsage?: RunTokenUsage;
  };
}

/** Task — high-level task with optional plan */
export interface Task {
  id: string;
  prompt: string;
  planId?: string;
  status: PlanStatus;
  createdAt: string;
}
