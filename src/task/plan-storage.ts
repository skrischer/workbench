// src/task/plan-storage.ts — Plan Persistence as JSON Files

import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Plan, StepStatus, StepResult } from '../types/task.js';
import { validatePlan } from './validation.js';
import { createNotFoundError } from '../types/errors.js';

/**
 * PlanStorage — Manages plan persistence as JSON files
 * 
 * Plans are stored under ~/.workbench/plans/<plan-id>/plan.json
 */
export class PlanStorage {
  private baseDir: string;

  constructor(baseDir?: string) {
    const workbenchHome = process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
    this.baseDir = baseDir ?? path.join(workbenchHome, 'plans');
  }

  /**
   * Create a new plan and save it to disk
   * @param plan - The plan to create
   * @throws Error if plan validation fails or if plan with this ID already exists
   */
  async create(plan: Plan): Promise<void> {
    // Validate plan before saving
    validatePlan(plan);

    // Check if plan already exists
    const planPath = this.getPlanPath(plan.id);
    try {
      await fs.access(planPath);
      throw new Error(`Plan already exists: ${plan.id}`);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') {
          throw error; // Re-throw if it's not a "file not found" error
        }
        // ENOENT is expected, continue with creation
      } else {
        throw error;
      }
    }

    // Save the plan
    await this.save(plan);
  }

  /**
   * Load a plan from disk
   * @param id - The plan ID
   * @returns The loaded plan
   * @throws NotFoundError if plan file does not exist
   * @throws Error if plan is invalid
   */
  async load(id: string): Promise<Plan> {
    const planPath = this.getPlanPath(id);

    try {
      const content = await fs.readFile(planPath, 'utf-8');
      const plan = JSON.parse(content) as Plan;
      
      // Validate loaded plan
      validatePlan(plan);
      
      return plan;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          throw createNotFoundError('Plan', id);
        }
      }
      throw new Error(`Failed to load plan ${id}: ${error}`);
    }
  }

  /**
   * Save a plan to disk atomically (write to temp, then rename)
   * @param plan - The plan to save
   * @throws Error if plan validation fails
   */
  async save(plan: Plan): Promise<void> {
    // Validate before saving
    validatePlan(plan);

    const planDir = path.join(this.baseDir, plan.id);
    const planPath = this.getPlanPath(plan.id);
    const tempPath = `${planPath}.tmp`;

    // Ensure directory exists
    await fs.mkdir(planDir, { recursive: true });

    // Update timestamp
    plan.updatedAt = new Date().toISOString();

    // Write to temp file
    await fs.writeFile(
      tempPath,
      JSON.stringify(plan, null, 2),
      'utf-8'
    );

    // Atomic rename
    await fs.rename(tempPath, planPath);
  }

  /**
   * Update the status of a specific step within a plan
   * @param planId - The plan ID
   * @param stepId - The step ID to update
   * @param status - The new status
   * @param result - Optional step result (for completed/failed steps)
   * @throws Error if plan or step not found
   */
  async updateStepStatus(
    planId: string,
    stepId: string,
    status: StepStatus,
    result?: StepResult
  ): Promise<void> {
    // Load the plan
    const plan = await this.load(planId);

    // Find the step
    const stepIndex = plan.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) {
      throw new Error(`Step not found in plan ${planId}: ${stepId}`);
    }

    // Update step status
    plan.steps[stepIndex].status = status;

    // Update result if provided
    if (result !== undefined) {
      plan.steps[stepIndex].result = result;
    }

    // Save updated plan
    await this.save(plan);
  }

  /**
   * List all plans with metadata (without full steps)
   * @returns Array of plan metadata
   */
  async list(): Promise<Array<{
    id: string;
    title: string;
    description: string;
    status: Plan['status'];
    createdAt: string;
    updatedAt: string;
    stepCount: number;
  }>> {
    try {
      // Read all subdirectories in baseDir
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const planIds = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

      // Load metadata for each plan
      const metadataList = await Promise.all(
        planIds.map(async (id) => {
          try {
            const plan = await this.load(id);
            return {
              id: plan.id,
              title: plan.title,
              description: plan.description,
              status: plan.status,
              createdAt: plan.createdAt,
              updatedAt: plan.updatedAt,
              stepCount: plan.steps.length,
            };
          } catch {
            // Skip plans that can't be loaded
            return null;
          }
        })
      );

      // Filter out nulls and return
      return metadataList.filter(
        (metadata): metadata is NonNullable<typeof metadata> => metadata !== null
      );
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          // Base directory doesn't exist yet, return empty list
          return [];
        }
      }
      throw new Error(`Failed to list plans: ${error}`);
    }
  }

  /**
   * Delete a plan from disk
   * @param id - The plan ID to delete
   * @throws Error if plan directory cannot be deleted
   */
  async delete(id: string): Promise<void> {
    const planDir = path.join(this.baseDir, id);

    try {
      await fs.rm(planDir, { recursive: true, force: true });
    } catch (error: unknown) {
      throw new Error(`Failed to delete plan ${id}: ${error}`);
    }
  }

  /**
   * Get the file path for a plan
   * @param id - The plan ID
   * @returns The full path to the plan.json file
   */
  private getPlanPath(id: string): string {
    return path.join(this.baseDir, id, 'plan.json');
  }
}
