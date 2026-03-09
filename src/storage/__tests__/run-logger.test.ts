// src/storage/__tests__/run-logger.test.ts — Tests for RunLogger

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { RunLogger } from '../run-logger.js';

describe('RunLogger', () => {
  let tempDir: string;
  let logger: RunLogger;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'run-logger-test-'));
    logger = new RunLogger(tempDir);
  });

  afterEach(async () => {
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should start a new run and flush to disk on end', async () => {
    const runId = 'test-run-1';
    const prompt = 'Test prompt';

    logger.startRun(runId, prompt);
    await logger.endRun(runId, 'completed');

    const runDir = join(tempDir, 'runs', runId);
    expect(existsSync(runDir)).toBe(true);

    const runJsonPath = join(runDir, 'run.json');
    const runJson = await readFile(runJsonPath, 'utf-8');
    const metadata = JSON.parse(runJson);

    expect(metadata.id).toBe(runId);
    expect(metadata.prompt).toBe(prompt);
    expect(metadata.status).toBe('completed');
    expect(metadata.startedAt).toBeDefined();
    expect(metadata.endedAt).toBeDefined();
  });

  it('should log steps and persist to messages.json', async () => {
    const runId = 'test-run-2';

    logger.startRun(runId, 'Test');
    logger.logStep(runId, { role: 'user', content: 'Hello' }, 0);
    logger.logStep(runId, { role: 'assistant', content: 'Hi there', toolCalls: ['call_1'] }, 1);
    await logger.endRun(runId, 'completed');

    const messagesJsonPath = join(tempDir, 'runs', runId, 'messages.json');
    const messagesJson = await readFile(messagesJsonPath, 'utf-8');
    const messages = JSON.parse(messagesJson);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'user', content: 'Hello', stepIndex: 0 });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Hi there', toolCalls: ['call_1'], stepIndex: 1 });
  });

  it('should log tool calls and persist to tool-calls.json', async () => {
    const runId = 'test-run-3';

    logger.startRun(runId, 'Test');
    logger.logToolCall(
      runId,
      {
        toolName: 'read_file',
        input: { path: '/test/file.txt' },
        output: 'file content',
        durationMs: 150,
      },
      0
    );
    await logger.endRun(runId, 'completed');

    const toolCallsJsonPath = join(tempDir, 'runs', runId, 'tool-calls.json');
    const toolCallsJson = await readFile(toolCallsJsonPath, 'utf-8');
    const toolCalls = JSON.parse(toolCallsJson);

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]).toEqual({
      toolName: 'read_file',
      input: { path: '/test/file.txt' },
      output: 'file content',
      durationMs: 150,
      stepIndex: 0,
    });
  });

  it('should load run from disk correctly (roundtrip)', async () => {
    const runId = 'test-run-4';
    const prompt = 'Roundtrip test';

    logger.startRun(runId, prompt);
    logger.logStep(runId, { role: 'user', content: 'Input' }, 0);
    logger.logToolCall(
      runId,
      {
        toolName: 'test_tool',
        input: { arg: 'value' },
        output: 'result',
        durationMs: 200,
      },
      1
    );
    await logger.endRun(runId, 'completed', {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });

    const loaded = await logger.loadRun(runId);

    expect(loaded).not.toBeNull();
    expect(loaded!.metadata.id).toBe(runId);
    expect(loaded!.metadata.prompt).toBe(prompt);
    expect(loaded!.metadata.status).toBe('completed');
    expect(loaded!.metadata.tokenUsage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });
    expect(loaded!.messages).toHaveLength(1);
    expect(loaded!.messages[0].content).toBe('Input');
    expect(loaded!.toolCalls).toHaveLength(1);
    expect(loaded!.toolCalls[0].toolName).toBe('test_tool');
  });

  it('should throw NotFoundError for non-existent run', async () => {
    const { isNotFoundError } = await import('../../types/errors.js');
    
    await expect(logger.loadRun('non-existent-run')).rejects.toThrow();
    
    try {
      await logger.loadRun('non-existent-run');
      expect.fail('Should have thrown NotFoundError');
    } catch (error) {
      expect(isNotFoundError(error)).toBe(true);
      if (isNotFoundError(error)) {
        expect(error.name).toBe('NotFoundError');
        expect(error.resource).toBe('Run');
        expect(error.id).toBe('non-existent-run');
        expect(error.message).toBe('Run not found: non-existent-run');
      }
    }
  });

  it('should create pretty-printed JSON files', async () => {
    const runId = 'test-run-5';

    logger.startRun(runId, 'Pretty print test');
    logger.logStep(runId, { role: 'user', content: 'Test' }, 0);
    await logger.endRun(runId, 'completed');

    const runJsonPath = join(tempDir, 'runs', runId, 'run.json');
    const runJson = await readFile(runJsonPath, 'utf-8');

    // Check that JSON is pretty-printed with 2-space indent
    expect(runJson).toContain('\n');
    expect(runJson).toMatch(/{\n {2}"/); // 2-space indent pattern
  });

  it('should handle different run statuses', async () => {
    const statuses: Array<'completed' | 'failed' | 'cancelled'> = ['completed', 'failed', 'cancelled'];

    for (const status of statuses) {
      const runId = `test-run-status-${status}`;
      logger.startRun(runId, 'Status test');
      await logger.endRun(runId, status);

      const loaded = await logger.loadRun(runId);
      expect(loaded!.metadata.status).toBe(status);
    }
  });

  it('should list all runs with metadata', async () => {
    // Create multiple runs
    logger.startRun('list-run-1', 'First run');
    await logger.endRun('list-run-1', 'completed', {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });

    logger.startRun('list-run-2', 'Second run');
    await logger.endRun('list-run-2', 'failed');

    logger.startRun('list-run-3', 'Third run');
    await logger.endRun('list-run-3', 'completed');

    const runs = await logger.listRuns();

    expect(runs).toHaveLength(3);
    expect(runs.map(r => r.id).sort()).toEqual(['list-run-1', 'list-run-2', 'list-run-3']);
    
    const run1 = runs.find(r => r.id === 'list-run-1');
    expect(run1!.prompt).toBe('First run');
    expect(run1!.status).toBe('completed');
    expect(run1!.tokenUsage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    });

    const run2 = runs.find(r => r.id === 'list-run-2');
    expect(run2!.status).toBe('failed');
  });

  it('should return empty array when no runs directory exists', async () => {
    const runs = await logger.listRuns();
    expect(runs).toEqual([]);
  });
});
