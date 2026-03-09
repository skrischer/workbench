// src/workflows/scheduler.ts — Workflow Scheduler

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { ScheduleConfig } from '../types/workflow.js';
import type { TypedEventBus } from '../events/event-bus.js';
import type { WorkflowRegistry } from './registry.js';
import type { WorkflowRunner } from './runner.js';
import type { AnthropicClient } from '../llm/anthropic-client.js';
import type { SessionStorage } from '../storage/session-storage.js';
import type { ToolRegistry } from '../tools/registry.js';

/**
 * WorkflowScheduler — Schedule workflows to run on cron or event triggers.
 * 
 * This is a standalone module that can be imported and controlled by the Dashboard
 * but is NOT implemented inside the Dashboard itself.
 * 
 * Features:
 * - Cron-based scheduling (e.g., every 6 hours with cron pattern)
 * - Event-based triggers (e.g., "run:end" = after any run completes)
 * - JSON persistence (survives restarts)
 * - CRUD operations for schedules
 */
export class WorkflowScheduler {
  private schedules: Map<string, ScheduleConfig> = new Map();
  private cronTimers: Map<string, NodeJS.Timeout> = new Map();
  private eventUnsubscribers: Map<string, () => void> = new Map();
  private isRunning = false;
  private persistencePath: string;

  constructor(
    private workflowRegistry: WorkflowRegistry,
    private anthropicClient: AnthropicClient,
    private sessionStorage: SessionStorage,
    private toolRegistry: ToolRegistry,
    private eventBus?: TypedEventBus,
    storageDir?: string
  ) {
    const workbenchHome = process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
    const scheduleDir = storageDir ?? path.join(workbenchHome, 'schedules');
    this.persistencePath = path.join(scheduleDir, 'schedules.json');
  }

  /**
   * Start the scheduler (load schedules, activate cron/event listeners).
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Scheduler is already running');
    }

    // Load schedules from disk
    await this.loadSchedules();

    // Activate all enabled schedules
    for (const schedule of this.schedules.values()) {
      if (schedule.enabled) {
        this.activateSchedule(schedule);
      }
    }

    this.isRunning = true;
  }

  /**
   * Stop the scheduler (clear all timers and event listeners).
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    // Clear all cron timers
    for (const timer of this.cronTimers.values()) {
      clearTimeout(timer);
    }
    this.cronTimers.clear();

    // Unsubscribe from all events
    for (const unsubscribe of this.eventUnsubscribers.values()) {
      unsubscribe();
    }
    this.eventUnsubscribers.clear();

    this.isRunning = false;
  }

  /**
   * Create a new schedule.
   * @param config - Schedule configuration (without id, createdAt)
   * @returns The created schedule with generated id and timestamps
   */
  async createSchedule(
    config: Omit<ScheduleConfig, 'id' | 'createdAt'>
  ): Promise<ScheduleConfig> {
    // Validate that workflow exists
    const workflow = this.workflowRegistry.get(config.workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${config.workflowId}' not found`);
    }

    // Validate that either cron or onEvent is provided
    if (!config.cron && !config.onEvent) {
      throw new Error('Either cron or onEvent must be specified');
    }

    // Validate cron expression if provided
    if (config.cron) {
      this.validateCron(config.cron);
    }

    // Create schedule with generated id and timestamp
    const schedule: ScheduleConfig = {
      ...config,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    // Calculate nextRunAt for cron schedules
    if (schedule.cron) {
      schedule.nextRunAt = this.calculateNextRunTime(schedule.cron);
    }

    // Store in memory
    this.schedules.set(schedule.id, schedule);

    // Activate if enabled and scheduler is running
    if (schedule.enabled && this.isRunning) {
      this.activateSchedule(schedule);
    }

    // Persist to disk
    await this.saveSchedules();

    return schedule;
  }

  /**
   * Get a schedule by ID.
   */
  getSchedule(id: string): ScheduleConfig | undefined {
    return this.schedules.get(id);
  }

  /**
   * List all schedules.
   */
  listSchedules(): ScheduleConfig[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Update a schedule.
   */
  async updateSchedule(
    id: string,
    updates: Partial<Omit<ScheduleConfig, 'id' | 'createdAt'>>
  ): Promise<ScheduleConfig> {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error(`Schedule '${id}' not found`);
    }

    // Deactivate old schedule if running
    if (this.isRunning && schedule.enabled) {
      this.deactivateSchedule(id);
    }

    // Apply updates
    const updated: ScheduleConfig = {
      ...schedule,
      ...updates,
    };

    // Validate cron if changed
    if (updates.cron && updates.cron !== schedule.cron) {
      this.validateCron(updates.cron);
      updated.nextRunAt = this.calculateNextRunTime(updates.cron);
    }

    // Update in memory
    this.schedules.set(id, updated);

    // Reactivate if enabled and scheduler is running
    if (updated.enabled && this.isRunning) {
      this.activateSchedule(updated);
    }

    // Persist to disk
    await this.saveSchedules();

    return updated;
  }

  /**
   * Delete a schedule.
   */
  async deleteSchedule(id: string): Promise<void> {
    const schedule = this.schedules.get(id);
    if (!schedule) {
      throw new Error(`Schedule '${id}' not found`);
    }

    // Deactivate if running
    if (this.isRunning && schedule.enabled) {
      this.deactivateSchedule(id);
    }

    // Remove from memory
    this.schedules.delete(id);

    // Persist to disk
    await this.saveSchedules();
  }

  /**
   * Activate a schedule (start cron timer or event listener).
   */
  private activateSchedule(schedule: ScheduleConfig): void {
    if (schedule.cron) {
      this.activateCronSchedule(schedule);
    } else if (schedule.onEvent) {
      this.activateEventSchedule(schedule);
    }
  }

  /**
   * Deactivate a schedule (stop cron timer or event listener).
   */
  private deactivateSchedule(id: string): void {
    // Clear cron timer if exists
    const timer = this.cronTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.cronTimers.delete(id);
    }

    // Unsubscribe from event if exists
    const unsubscribe = this.eventUnsubscribers.get(id);
    if (unsubscribe) {
      unsubscribe();
      this.eventUnsubscribers.delete(id);
    }
  }

  /**
   * Activate a cron-based schedule.
   */
  private activateCronSchedule(schedule: ScheduleConfig): void {
    if (!schedule.cron) return;

    const executeAndReschedule = async () => {
      // Execute workflow
      await this.executeScheduledWorkflow(schedule);

      // Reschedule if still enabled
      const current = this.schedules.get(schedule.id);
      if (current?.enabled && current.cron) {
        this.activateCronSchedule(current);
      }
    };

    // Calculate delay until next run
    const nextRunTime = this.calculateNextRunTime(schedule.cron);
    const delay = new Date(nextRunTime).getTime() - Date.now();

    // Schedule execution
    const timer = setTimeout(executeAndReschedule, delay);
    this.cronTimers.set(schedule.id, timer);
  }

  /**
   * Activate an event-based schedule.
   */
  private activateEventSchedule(schedule: ScheduleConfig): void {
    if (!schedule.onEvent || !this.eventBus) return;

    const listener = () => {
      this.executeScheduledWorkflow(schedule);
    };

    // Subscribe to event (cast to any to bypass type checking)
    const unsubscribe = (this.eventBus as any).on(schedule.onEvent, listener);
    this.eventUnsubscribers.set(schedule.id, unsubscribe);
  }

  /**
   * Execute a scheduled workflow.
   */
  private async executeScheduledWorkflow(schedule: ScheduleConfig): Promise<void> {
    try {
      const workflow = this.workflowRegistry.get(schedule.workflowId);
      if (!workflow) {
        console.error(`[Scheduler] Workflow '${schedule.workflowId}' not found`);
        return;
      }

      // Dynamically import WorkflowRunner to avoid circular dependency
      const { WorkflowRunner } = await import('./runner.js');

      const runner = new WorkflowRunner(
        workflow,
        this.anthropicClient,
        this.sessionStorage,
        this.toolRegistry,
        this.eventBus
      );

      console.log(`[Scheduler] Executing workflow '${schedule.workflowId}' (schedule: ${schedule.id})`);
      await runner.run(schedule.params);

      // Update lastRunAt
      const updated = this.schedules.get(schedule.id);
      if (updated) {
        updated.lastRunAt = new Date().toISOString();
        if (updated.cron) {
          updated.nextRunAt = this.calculateNextRunTime(updated.cron);
        }
        this.schedules.set(schedule.id, updated);
        await this.saveSchedules();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler] Failed to execute workflow '${schedule.workflowId}':`, message);
    }
  }

  /**
   * Validate cron expression (basic validation).
   */
  private validateCron(cron: string): void {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression: '${cron}' (expected 5 fields: minute hour day month weekday)`);
    }
  }

  /**
   * Calculate next run time from cron expression (simplified implementation).
   * For MVP, supports basic patterns like hourly and interval-based schedules.
   */
  private calculateNextRunTime(cron: string): string {
    const parts = cron.trim().split(/\s+/);
    const [minute, hour] = parts;

    const now = new Date();
    const next = new Date(now);

    // Parse minute
    const minVal = minute === '*' ? now.getMinutes() : parseInt(minute, 10);
    next.setMinutes(minVal);
    next.setSeconds(0);
    next.setMilliseconds(0);

    // Parse hour (supports */N syntax)
    if (hour.startsWith('*/')) {
      const interval = parseInt(hour.slice(2), 10);
      const currentHour = now.getHours();
      const nextHour = Math.ceil((currentHour + 1) / interval) * interval;
      next.setHours(nextHour);

      // If we've gone past the current time, it's correct
      if (next.getTime() <= now.getTime()) {
        next.setTime(next.getTime() + interval * 60 * 60 * 1000);
      }
    } else if (hour === '*') {
      next.setHours(now.getHours());
      if (next.getTime() <= now.getTime()) {
        next.setHours(next.getHours() + 1);
      }
    } else {
      next.setHours(parseInt(hour, 10));
      if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
      }
    }

    return next.toISOString();
  }

  /**
   * Load schedules from disk.
   */
  private async loadSchedules(): Promise<void> {
    try {
      const content = await fs.readFile(this.persistencePath, 'utf-8');
      const data = JSON.parse(content) as ScheduleConfig[];
      this.schedules.clear();
      for (const schedule of data) {
        this.schedules.set(schedule.id, schedule);
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          // File doesn't exist yet, start with empty schedules
          return;
        }
      }
      throw new Error(`Failed to load schedules: ${error}`);
    }
  }

  /**
   * Save schedules to disk (atomic write).
   */
  private async saveSchedules(): Promise<void> {
    const scheduleDir = path.dirname(this.persistencePath);
    await fs.mkdir(scheduleDir, { recursive: true });

    const tempPath = `${this.persistencePath}.tmp`;
    const data = Array.from(this.schedules.values());

    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, this.persistencePath);
  }
}
