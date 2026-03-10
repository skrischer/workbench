// src/memory/__tests__/auto-memory.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAutoMemoryHook } from '../auto-memory.js';
import type { AutoMemoryConfig } from '../auto-memory.js';
import type { RunResult, Message } from '../../types/index.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { RunLogger } from '../../storage/run-logger.js';
import type { LanceDBMemoryStore } from '../lancedb-store.js';
import type { UserConfig } from '../../config/user-config.js';
import type { RunLog } from '../../types/run.js';

describe('createAutoMemoryHook', () => {
  let mockSessionStorage: SessionStorage;
  let mockRunLogger: RunLogger;
  let mockMemoryStore: LanceDBMemoryStore;
  let userConfig: UserConfig;

  beforeEach(() => {
    // Mock SessionStorage
    mockSessionStorage = {
      load: vi.fn(),
    } as unknown as SessionStorage;

    // Mock RunLogger
    mockRunLogger = {
      loadRun: vi.fn(),
      updateRunMetadata: vi.fn(),
    } as unknown as RunLogger;

    // Mock LanceDBMemoryStore
    mockMemoryStore = {
      init: vi.fn(),
      add: vi.fn(),
    } as unknown as LanceDBMemoryStore;

    // Default user config
    userConfig = {
      autoSummarize: true,
      minMessagesForSummary: 3,
    };
  });

  it('should skip summarization when autoSummarize is false', async () => {
    userConfig.autoSummarize = false;

    const config: AutoMemoryConfig = {
      sessionStorage: mockSessionStorage,
      runLogger: mockRunLogger,
      memoryStore: mockMemoryStore,
      userConfig,
    };

    const hook = createAutoMemoryHook(config);
    const result: RunResult = {
      sessionId: 'test-session',
      steps: 5,
      finalResponse: 'Done',
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
      status: 'completed',
    };

    if (hook) { await hook(result, { runId: "test-run" }); }

    // Verify no storage operations were called
    expect(mockSessionStorage.load).not.toHaveBeenCalled();
    expect(mockMemoryStore.add).not.toHaveBeenCalled();
  });

  it('should skip summarization when noSummarize CLI flag is true', async () => {
    const config: AutoMemoryConfig = {
      sessionStorage: mockSessionStorage,
      runLogger: mockRunLogger,
      memoryStore: mockMemoryStore,
      userConfig,
      noSummarize: true, // CLI flag override
    };

    const hook = createAutoMemoryHook(config);
    const result: RunResult = {
      sessionId: 'test-session',
      steps: 5,
      finalResponse: 'Done',
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
      status: 'completed',
    };

    if (hook) { await hook(result, { runId: "test-run" }); }

    // Verify no storage operations were called
    expect(mockSessionStorage.load).not.toHaveBeenCalled();
    expect(mockMemoryStore.add).not.toHaveBeenCalled();
  });

  it('should skip summarization when message count is below minimum', async () => {
    const config: AutoMemoryConfig = {
      sessionStorage: mockSessionStorage,
      runLogger: mockRunLogger,
      memoryStore: mockMemoryStore,
      userConfig,
    };

    // Mock session with only 2 messages (below min of 3)
    vi.mocked(mockSessionStorage.load).mockResolvedValue({
      id: 'test-session',
      agentId: 'test-agent',
      messages: [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Hi', timestamp: new Date().toISOString() },
      ] as Message[],
      toolCalls: [],
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const hook = createAutoMemoryHook(config);
    const result: RunResult = {
      sessionId: 'test-session',
      steps: 2,
      finalResponse: 'Done',
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
      status: 'completed',
    };

    if (hook) { await hook(result, { runId: "test-run" }); }

    // Verify session was loaded but memory was not created
    expect(mockSessionStorage.load).toHaveBeenCalledWith('test-session');
    expect(mockMemoryStore.add).not.toHaveBeenCalled();
  });

  it('should create memory entry when conditions are met', async () => {
    const config: AutoMemoryConfig = {
      sessionStorage: mockSessionStorage,
      runLogger: mockRunLogger,
      memoryStore: mockMemoryStore,
      userConfig,
    };

    // Mock session with enough messages
    const messages: Message[] = [
      { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Hi', timestamp: new Date().toISOString() },
      { role: 'user', content: 'How are you?', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Good!', timestamp: new Date().toISOString() },
    ];

    vi.mocked(mockSessionStorage.load).mockResolvedValue({
      id: 'test-session',
      agentId: 'test-agent',
      messages,
      toolCalls: [],
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Mock run log
    const runLog: RunLog = {
      metadata: {
        id: 'test-run',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        status: 'completed',
        prompt: 'Test prompt',
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      },
      messages: [],
      toolCalls: [],
    };
    vi.mocked(mockRunLogger.loadRun).mockResolvedValue(runLog);

    // Mock memory store
    vi.mocked(mockMemoryStore.add).mockResolvedValue({
      id: 'memory-123',
      type: 'session',
      content: 'Test summary',
      tags: ['session'],
      source: { type: 'session', sessionId: 'test-session', runId: 'test-run' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const hook = createAutoMemoryHook(config);
    const result: RunResult = {
      sessionId: 'test-session',
      steps: 4,
      finalResponse: 'Done',
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
      status: 'completed',
    };

    if (hook) { await hook(result, { runId: "test-run" }); }

    // Verify memory store operations
    expect(mockMemoryStore.init).toHaveBeenCalled();
    expect(mockMemoryStore.add).toHaveBeenCalled();
    expect(mockRunLogger.updateRunMetadata).toHaveBeenCalledWith(
      'test-run',
      expect.objectContaining({
        memoryId: 'memory-123',
      })
    );
  });

  it('should handle summarization errors gracefully without throwing', async () => {
    const config: AutoMemoryConfig = {
      sessionStorage: mockSessionStorage,
      runLogger: mockRunLogger,
      memoryStore: mockMemoryStore,
      userConfig,
    };

    // Mock session
    vi.mocked(mockSessionStorage.load).mockResolvedValue({
      id: 'test-session',
      agentId: 'test-agent',
      messages: [
        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Hi', timestamp: new Date().toISOString() },
        { role: 'user', content: 'Test', timestamp: new Date().toISOString() },
      ] as Message[],
      toolCalls: [],
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Mock run log that throws error
    vi.mocked(mockRunLogger.loadRun).mockRejectedValue(new Error('Database error'));

    const hook = createAutoMemoryHook(config);
    const result: RunResult = {
      sessionId: 'test-session',
      steps: 3,
      finalResponse: 'Done',
      tokenUsage: { input_tokens: 50, output_tokens: 20 },
      status: 'completed',
    };

    // Should not throw, just log warning
    if (hook) {
      await expect(hook(result, { runId: 'test-run' })).resolves.not.toThrow();
    }
  });

  it('should extract modified files from tool calls', async () => {
    const config: AutoMemoryConfig = {
      sessionStorage: mockSessionStorage,
      runLogger: mockRunLogger,
      memoryStore: mockMemoryStore,
      userConfig,
    };

    // Mock session
    vi.mocked(mockSessionStorage.load).mockResolvedValue({
      id: 'test-session',
      agentId: 'test-agent',
      messages: [
        { role: 'user', content: 'Write file', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'Done', timestamp: new Date().toISOString() },
        { role: 'user', content: 'Edit file', timestamp: new Date().toISOString() },
      ] as Message[],
      toolCalls: [],
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Mock run log with tool calls
    const runLog: RunLog = {
      metadata: {
        id: 'test-run',
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        status: 'completed',
        prompt: 'Test',
        tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      },
      messages: [],
      toolCalls: [
        {
          toolName: 'write_file',
          input: { path: '/test/file.ts', content: 'test' },
          output: 'Success',
          durationMs: 10,
          stepIndex: 1,
        },
        {
          toolName: 'edit_file',
          input: { path: '/test/file2.ts', changes: 'edit' },
          output: 'Success',
          durationMs: 15,
          stepIndex: 2,
        },
      ],
    };
    vi.mocked(mockRunLogger.loadRun).mockResolvedValue(runLog);

    // Mock memory store
    vi.mocked(mockMemoryStore.add).mockResolvedValue({
      id: 'memory-123',
      type: 'session',
      content: 'Test summary',
      tags: ['session'],
      source: { type: 'session', sessionId: 'test-session', runId: 'test-run' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const hook = createAutoMemoryHook(config);
    const result: RunResult = {
      sessionId: 'test-session',
      steps: 3,
      finalResponse: 'Done',
      tokenUsage: { input_tokens: 100, output_tokens: 50 },
      status: 'completed',
    };

    if (hook) { await hook(result, { runId: "test-run" }); }

    // Verify memory was created with correct file list
    expect(mockMemoryStore.add).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          relatedFiles: expect.arrayContaining(['/test/file.ts', '/test/file2.ts']),
        }),
      })
    );
  });
});
