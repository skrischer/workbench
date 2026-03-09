// src/workflows/__tests__/scheduler.test.ts — Workflow Scheduler Tests

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { WorkflowScheduler } from '../scheduler.js';
import { WorkflowRegistry } from '../registry.js';
import { TypedEventBus } from '../../events/event-bus.js';
import type { WorkflowDefinition, ScheduleConfig } from '../../types/workflow.js';
import type { AnthropicClient } from '../../llm/anthropic-client.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { ToolRegistry } from '../../tools/registry.js';

describe('WorkflowScheduler', () => {
  let scheduler: WorkflowScheduler;
  let registry: WorkflowRegistry;
  let eventBus: TypedEventBus;
  let storageDir: string;
  let mockAnthropicClient: AnthropicClient;
  let mockSessionStorage: SessionStorage;
  let mockToolRegistry: ToolRegistry;

  // Mock workflow definition
  const mockWorkflow: WorkflowDefinition = {
    id: 'test-workflow',
    name: 'Test Workflow',
    description: 'A test workflow',
    systemPrompt: 'Test prompt',
    tools: ['read', 'write'],
    defaultMaxSteps: 10,
    inputSchema: {
      required: [],
      optional: [],
    },
    validateInput: () => null,
  };

  beforeEach(async () => {
    // Create temporary storage directory
    storageDir = path.join(tmpdir(), `scheduler-test-${randomUUID()}`);
    await fs.mkdir(storageDir, { recursive: true });

    // Create mock dependencies
    registry = new WorkflowRegistry();
    registry.register(mockWorkflow);
    eventBus = new TypedEventBus();
    mockAnthropicClient = {} as AnthropicClient;
    mockSessionStorage = {} as SessionStorage;
    mockToolRegistry = {} as ToolRegistry;

    // Create scheduler
    scheduler = new WorkflowScheduler(
      registry,
      mockAnthropicClient,
      mockSessionStorage,
      mockToolRegistry,
      eventBus,
      storageDir
    );
  });

  afterEach(async () => {
    // Stop scheduler if running
    scheduler.stop();

    // Clean up temporary storage
    try {
      await fs.rm(storageDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('1. Schedule Creation', () => {
    it('should create a cron-based schedule', async () => {
      const schedule = await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: { test: true },
        cron: '0 */6 * * *',
        enabled: true,
      });

      expect(schedule).toMatchObject({
        workflowId: 'test-workflow',
        params: { test: true },
        cron: '0 */6 * * *',
        enabled: true,
      });
      expect(schedule.id).toBeDefined();
      expect(schedule.createdAt).toBeDefined();
      expect(schedule.nextRunAt).toBeDefined();
    });

    it('should create an event-based schedule', async () => {
      const schedule = await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: { test: true },
        onEvent: 'run:end',
        enabled: true,
      });

      expect(schedule).toMatchObject({
        workflowId: 'test-workflow',
        params: { test: true },
        onEvent: 'run:end',
        enabled: true,
      });
      expect(schedule.id).toBeDefined();
      expect(schedule.createdAt).toBeDefined();
      expect(schedule.nextRunAt).toBeUndefined();
    });

    it('should reject schedule for non-existent workflow', async () => {
      await expect(
        scheduler.createSchedule({
          workflowId: 'non-existent',
          params: {},
          cron: '0 0 * * *',
          enabled: true,
        })
      ).rejects.toThrow("Workflow 'non-existent' not found");
    });

    it('should reject schedule without cron or onEvent', async () => {
      await expect(
        scheduler.createSchedule({
          workflowId: 'test-workflow',
          params: {},
          enabled: true,
        } as any)
      ).rejects.toThrow('Either cron or onEvent must be specified');
    });

    it('should reject invalid cron expression', async () => {
      await expect(
        scheduler.createSchedule({
          workflowId: 'test-workflow',
          params: {},
          cron: 'invalid cron',
          enabled: true,
        })
      ).rejects.toThrow('Invalid cron expression');
    });
  });

  describe('2. Schedule CRUD Operations', () => {
    it('should list all schedules', async () => {
      await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        cron: '0 0 * * *',
        enabled: true,
      });

      await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        onEvent: 'run:end',
        enabled: true,
      });

      const schedules = scheduler.listSchedules();
      expect(schedules).toHaveLength(2);
    });

    it('should get a schedule by ID', async () => {
      const created = await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        cron: '0 0 * * *',
        enabled: true,
      });

      const retrieved = scheduler.getSchedule(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should update a schedule', async () => {
      const created = await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: { old: true },
        cron: '0 0 * * *',
        enabled: true,
      });

      const updated = await scheduler.updateSchedule(created.id, {
        params: { new: true },
        enabled: false,
      });

      expect(updated.params).toEqual({ new: true });
      expect(updated.enabled).toBe(false);
    });

    it('should delete a schedule', async () => {
      const created = await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        cron: '0 0 * * *',
        enabled: true,
      });

      await scheduler.deleteSchedule(created.id);

      const retrieved = scheduler.getSchedule(created.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('3. Scheduler Lifecycle', () => {
    it('should start and stop scheduler', async () => {
      await scheduler.start();
      expect(scheduler['isRunning']).toBe(true);

      scheduler.stop();
      expect(scheduler['isRunning']).toBe(false);
    });

    it('should reject starting scheduler twice', async () => {
      await scheduler.start();
      await expect(scheduler.start()).rejects.toThrow('Scheduler is already running');
      scheduler.stop();
    });
  });

  describe('4. Persistence', () => {
    it('should persist schedules to disk', async () => {
      await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        cron: '0 0 * * *',
        enabled: true,
      });

      // Verify file was written
      const persistencePath = path.join(storageDir, 'schedules.json');
      const content = await fs.readFile(persistencePath, 'utf-8');
      const data = JSON.parse(content) as ScheduleConfig[];

      expect(data).toHaveLength(1);
      expect(data[0].workflowId).toBe('test-workflow');
    });

    it('should load schedules from disk on start', async () => {
      // Create schedule and stop scheduler
      await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        cron: '0 0 * * *',
        enabled: true,
      });

      // Create new scheduler instance (simulates restart)
      const newScheduler = new WorkflowScheduler(
        registry,
        mockAnthropicClient,
        mockSessionStorage,
        mockToolRegistry,
        eventBus,
        storageDir
      );

      await newScheduler.start();

      const schedules = newScheduler.listSchedules();
      expect(schedules).toHaveLength(1);
      expect(schedules[0].workflowId).toBe('test-workflow');

      newScheduler.stop();
    });
  });

  describe('5. Event-Based Scheduling', () => {
    it('should trigger workflow on event', async () => {
      let executed = false;

      // Mock WorkflowRunner execution
      vi.mock('../runner.js', () => ({
        WorkflowRunner: class {
          async run() {
            executed = true;
            return { status: 'completed', output: 'test' };
          }
        },
      }));

      await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        onEvent: 'run:end',
        enabled: true,
      });

      await scheduler.start();

      // Emit event
      eventBus.emit('run:end', {
        runId: 'test',
        result: 'test',
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      });

      // Wait a bit for async execution
      await new Promise((resolve) => setTimeout(resolve, 100));

      scheduler.stop();
    });
  });

  describe('6. Cron Parsing', () => {
    it('should calculate next run time for hourly cron', async () => {
      const schedule = await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        cron: '0 * * * *', // Every hour
        enabled: true,
      });

      expect(schedule.nextRunAt).toBeDefined();
      const nextRun = new Date(schedule.nextRunAt!);
      const now = new Date();

      // Should be in the future
      expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should calculate next run time for interval cron', async () => {
      const schedule = await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        cron: '0 */6 * * *', // Every 6 hours
        enabled: true,
      });

      expect(schedule.nextRunAt).toBeDefined();
      const nextRun = new Date(schedule.nextRunAt!);
      const now = new Date();

      // Should be in the future
      expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('7. Schedule Activation/Deactivation', () => {
    it('should activate schedules on start', async () => {
      await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        cron: '0 0 * * *',
        enabled: true,
      });

      await scheduler.start();

      // Check that cron timer was created
      expect(scheduler['cronTimers'].size).toBe(1);

      scheduler.stop();
    });

    it('should not activate disabled schedules', async () => {
      await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        cron: '0 0 * * *',
        enabled: false,
      });

      await scheduler.start();

      // Check that no timers were created
      expect(scheduler['cronTimers'].size).toBe(0);

      scheduler.stop();
    });

    it('should deactivate schedules on stop', async () => {
      await scheduler.createSchedule({
        workflowId: 'test-workflow',
        params: {},
        cron: '0 0 * * *',
        enabled: true,
      });

      await scheduler.start();
      expect(scheduler['cronTimers'].size).toBe(1);

      scheduler.stop();
      expect(scheduler['cronTimers'].size).toBe(0);
    });
  });
});
