// src/storage/run-logger.ts — Persist Agent Runs as JSON Files

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import type { RunLog, RunMetadata, RunMessage, RunToolCall, RunLogStatus } from '../types/run.js';
import type { TokenUsage } from '../types/events.js';
import { createNotFoundError, isNotFoundError } from '../types/errors.js';

export class RunLogger {
  private baseDir: string;
  private runs: Map<string, RunLog> = new Map();

  constructor(baseDir: string = join(homedir(), '.workbench')) {
    this.baseDir = baseDir;
  }

  /**
   * Start a new run and initialize in-memory state
   */
  startRun(id: string, prompt: string): void {
    const metadata: RunMetadata = {
      id,
      startedAt: new Date().toISOString(),
      status: 'running',
      prompt,
    };

    this.runs.set(id, {
      metadata,
      messages: [],
      toolCalls: [],
    });
  }

  /**
   * Log a step message
   */
  logStep(runId: string, message: { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; toolCalls?: string[] }, stepIndex: number): void {
    const run = this.runs.get(runId);
    if (!run) {
      throw createNotFoundError('Run', runId);
    }

    const runMessage: RunMessage = {
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls,
      stepIndex,
    };

    run.messages.push(runMessage);
  }

  /**
   * Log a tool call
   */
  logToolCall(runId: string, toolCall: { toolName: string; input: Record<string, unknown>; output: string; durationMs: number }, stepIndex: number): void {
    const run = this.runs.get(runId);
    if (!run) {
      throw createNotFoundError('Run', runId);
    }

    const runToolCall: RunToolCall = {
      toolName: toolCall.toolName,
      input: toolCall.input,
      output: toolCall.output,
      durationMs: toolCall.durationMs,
      stepIndex,
    };

    run.toolCalls.push(runToolCall);
  }

  /**
   * End a run and flush to disk
   */
  async endRun(runId: string, status: RunLogStatus, tokenUsage?: TokenUsage): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw createNotFoundError('Run', runId);
    }

    run.metadata.endedAt = new Date().toISOString();
    run.metadata.status = status;
    if (tokenUsage) {
      run.metadata.tokenUsage = tokenUsage;
    }

    await this.flushToDisk(runId);
    this.runs.delete(runId);
  }

  /**
   * Write run data to disk
   */
  private async flushToDisk(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) {
      throw createNotFoundError('Run', runId);
    }

    const runDir = join(this.baseDir, 'runs', runId);
    await mkdir(runDir, { recursive: true });

    // Write run.json
    const runJsonPath = join(runDir, 'run.json');
    await writeFile(runJsonPath, JSON.stringify(run.metadata, null, 2));

    // Write messages.json
    const messagesJsonPath = join(runDir, 'messages.json');
    await writeFile(messagesJsonPath, JSON.stringify(run.messages, null, 2));

    // Write tool-calls.json
    const toolCallsJsonPath = join(runDir, 'tool-calls.json');
    await writeFile(toolCallsJsonPath, JSON.stringify(run.toolCalls, null, 2));
  }

  /**
   * Load a run from disk
   * @throws NotFoundError if run doesn't exist
   */
  async loadRun(runId: string): Promise<RunLog> {
    const runDir = join(this.baseDir, 'runs', runId);
    const runJsonPath = join(runDir, 'run.json');

    if (!existsSync(runJsonPath)) {
      throw createNotFoundError('Run', runId);
    }

    try {
      const metadataJson = await readFile(runJsonPath, 'utf-8');
      const metadata = JSON.parse(metadataJson) as RunMetadata;

      const messagesJsonPath = join(runDir, 'messages.json');
      const messagesJson = await readFile(messagesJsonPath, 'utf-8');
      const messages = JSON.parse(messagesJson) as RunMessage[];

      const toolCallsJsonPath = join(runDir, 'tool-calls.json');
      const toolCallsJson = await readFile(toolCallsJsonPath, 'utf-8');
      const toolCalls = JSON.parse(toolCallsJson) as RunToolCall[];

      return {
        metadata,
        messages,
        toolCalls,
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        throw error;
      }
      throw new Error(`Failed to load run ${runId}: ${error}`);
    }
  }

  /**
   * List all runs with metadata (no full message/tool-call load)
   * @returns Array of run metadata
   */
  async listRuns(): Promise<RunMetadata[]> {
    const { readdir } = await import('node:fs/promises');
    const runsDir = join(this.baseDir, 'runs');

    try {
      // Read all subdirectories in runsDir
      const entries = await readdir(runsDir, { withFileTypes: true });
      const runIds = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

      // Load metadata for each run
      const metadataList = await Promise.all(
        runIds.map(async (id) => {
          const runJsonPath = join(runsDir, id, 'run.json');
          
          if (!existsSync(runJsonPath)) {
            return null;
          }

          try {
            const metadataJson = await readFile(runJsonPath, 'utf-8');
            return JSON.parse(metadataJson) as RunMetadata;
          } catch {
            // Skip runs that can't be loaded
            return null;
          }
        })
      );

      // Filter out nulls and return
      return metadataList.filter(
        (metadata): metadata is RunMetadata => metadata !== null
      );
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          // Runs directory doesn't exist yet, return empty list
          return [];
        }
      }
      throw new Error(`Failed to list runs: ${error}`);
    }
  }
}
