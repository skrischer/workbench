// src/workflows/__tests__/runner-integration.test.ts — Workflow Runner Integration Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowRunner } from '../runner.js';
import type { WorkflowDefinition } from '../../types/workflow.js';
import type { AnthropicClient } from '../../llm/anthropic-client.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { ToolRegistry } from '../../tools/registry.js';
import type { TypedEventBus } from '../../events/event-bus.js';
import type { Session, Tool } from '../../types/index.js';

// Mock implementations
const createMockClient = (): AnthropicClient => ({
  sendMessage: vi.fn().mockResolvedValue({
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Workflow completed successfully' }],
    model: 'claude-3-5-sonnet-20241022',
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  }),
} as any);

const createMockStorage = (): SessionStorage => {
  const sessions = new Map<string, Session>();
  let idCounter = 0;

  return {
    create: vi.fn(async (agentId: string) => {
      const id = `session_${++idCounter}`;
      const session: Session = {
        id,
        agentId,
        messages: [],
        toolCalls: [],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sessions.set(id, session);
      return session;
    }),
    load: vi.fn(async (id: string) => {
      const session = sessions.get(id);
      if (!session) throw new Error(`Session ${id} not found`);
      return session;
    }),
    save: vi.fn(async (session: Session) => {
      sessions.set(session.id, session);
    }),
    addMessage: vi.fn(async (sessionId: string, message: any) => {
      const session = sessions.get(sessionId);
      if (session) {
        session.messages.push(message);
        session.updatedAt = new Date().toISOString();
      }
    }),
  } as any;
};

const createMockRegistry = (availableTools: string[] = []): ToolRegistry => {
  const tools = new Map<string, Tool>();
  
  // Register mock tools
  availableTools.forEach(name => {
    tools.set(name, {
      name,
      description: `Mock tool ${name}`,
      inputSchema: { type: 'object', properties: {} },
      execute: vi.fn().mockResolvedValue({ success: true, output: `${name} executed` }),
    });
  });

  return {
    get: vi.fn((name: string) => tools.get(name) || null),
    register: vi.fn(),
    list: vi.fn(() => Array.from(tools.values())),
  } as any;
};

const createMockEventBus = (): TypedEventBus => ({
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
} as any);

const createTestWorkflow = (overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition => ({
  id: 'test-workflow',
  name: 'Test Workflow',
  description: 'A test workflow',
  systemPrompt: 'You are a test assistant.',
  tools: ['read_file', 'write_file'],
  defaultMaxSteps: 10,
  inputSchema: {
    required: ['task'],
    optional: [],
  },
  validateInput: (input: Record<string, unknown>) => {
    if (!input.task) return 'Missing required parameter: task';
    if (typeof input.task !== 'string') return 'Parameter "task" must be a string';
    return null;
  },
  ...overrides,
});

describe('WorkflowRunner Integration Tests', () => {
  let client: AnthropicClient;
  let storage: SessionStorage;
  let registry: ToolRegistry;
  let eventBus: TypedEventBus;

  beforeEach(() => {
    client = createMockClient();
    storage = createMockStorage();
    registry = createMockRegistry(['read_file', 'write_file', 'forbidden_tool']);
    eventBus = createMockEventBus();
    vi.clearAllMocks();
  });

  describe('Test 1: Happy Path - Workflow Completion', () => {
    it('should run workflow and return completed result', async () => {
      const workflow = createTestWorkflow();
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      const result = await runner.run({ task: 'Test task' });

      expect(result.status).toBe('completed');
      expect(result.output).toBe('Workflow completed successfully');
      expect(result.workflowId).toBe('test-workflow');
      expect(result.tokenUsage.totalInputTokens).toBe(100);
      expect(result.tokenUsage.totalOutputTokens).toBe(50);
      expect(result.tokenUsage.totalTokens).toBe(150);
      expect(result.tokenUsage.stepCount).toBe(1);
      expect(result.durationMs).toBeGreaterThan(0);
    });
  });

  describe('Test 2: Tool Whitelist Enforcement', () => {
    it('should only expose whitelisted tools to AgentLoop', async () => {
      const workflow = createTestWorkflow({
        tools: ['read_file'], // Only read_file allowed
      });
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      // Mock LLM tries to use forbidden_tool
      (client.sendMessage as any).mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'forbidden_tool', input: {} },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const result = await runner.run({ task: 'Use forbidden tool' });

      // Tool execution should fail because forbidden_tool is not in whitelist
      expect(result.status).toBe('failed');
    });

    it('should allow all tools in whitelist', async () => {
      const workflow = createTestWorkflow({
        tools: ['read_file', 'write_file'],
      });
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      // Mock successful tool execution
      (client.sendMessage as any)
        .mockResolvedValueOnce({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tool_1', name: 'read_file', input: { path: 'test.txt' } }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'tool_use',
          usage: { input_tokens: 100, output_tokens: 50 },
        })
        .mockResolvedValueOnce({
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Done' }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          usage: { input_tokens: 120, output_tokens: 30 },
        });

      const result = await runner.run({ task: 'Read file' });

      expect(result.status).toBe('completed');
    });
  });

  describe('Test 3: System Prompt Configuration', () => {
    it('should include workflow system prompt and input context', async () => {
      const workflow = createTestWorkflow({
        systemPrompt: 'You are a code reviewer.',
      });
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      await runner.run({ task: 'Review code', file: 'test.ts' });

      // Verify sendMessage was called (system prompt is passed via options)
      expect(client.sendMessage).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          system: expect.stringContaining('You are a code reviewer.'),
        })
      );

      // Verify input context is added to system prompt as JSON
      const systemArg = (client.sendMessage as any).mock.calls[0][2].system;
      expect(systemArg).toContain('Input Context:');
      expect(systemArg).toContain('task');
      expect(systemArg).toContain('Review code');
      expect(systemArg).toContain('file');
      expect(systemArg).toContain('test.ts');
    });
  });

  describe('Test 4: Event Emission', () => {
    it('should emit workflow:start event with correct payload', async () => {
      const workflow = createTestWorkflow();
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      await runner.run({ task: 'Test task' });

      expect(eventBus.emit).toHaveBeenCalledWith('workflow:start', {
        workflowId: 'test-workflow',
        sessionId: expect.stringMatching(/^session_\d+$/),
        input: { task: 'Test task' },
      });
    });

    it('should emit workflow:end event with completed status', async () => {
      const workflow = createTestWorkflow();
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      await runner.run({ task: 'Test task' });

      expect(eventBus.emit).toHaveBeenCalledWith('workflow:end', {
        workflowId: 'test-workflow',
        sessionId: expect.stringMatching(/^session_\d+$/),
        status: 'completed',
        durationMs: expect.any(Number),
      });
    });

    it('should emit workflow:end event with failed status on error', async () => {
      const workflow = createTestWorkflow();
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      // Mock LLM error
      (client.sendMessage as any).mockRejectedValue(new Error('LLM API error'));

      await runner.run({ task: 'Test task' });

      expect(eventBus.emit).toHaveBeenCalledWith('workflow:end', {
        workflowId: 'test-workflow',
        sessionId: expect.stringMatching(/^session_\d+$/),
        status: 'failed',
        durationMs: expect.any(Number),
      });
    });
  });

  describe('Test 5: Error Handling', () => {
    it('should handle LLM errors and return failed result', async () => {
      const workflow = createTestWorkflow();
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      // Mock LLM error
      (client.sendMessage as any).mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await runner.run({ task: 'Test task' });

      expect(result.status).toBe('failed');
      expect(result.output).toContain('Error:');
      expect(result.output).toContain('API rate limit exceeded');
      expect(result.tokenUsage.totalTokens).toBe(0);
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should handle validation errors and return failed result', async () => {
      const workflow = createTestWorkflow();
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      const result = await runner.run({}); // Missing required 'task' parameter

      expect(result.status).toBe('failed');
      expect(result.output).toContain('Input validation failed');
      expect(result.output).toContain('Missing required parameter: task');
      expect(result.durationMs).toBe(0);
      expect(client.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle tool execution errors gracefully', async () => {
      const workflow = createTestWorkflow({
        tools: ['read_file'],
      });
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      // Mock tool failure
      const mockTool = registry.get('read_file');
      if (mockTool) {
        (mockTool.execute as any).mockResolvedValue({
          success: false,
          output: '',
          error: 'File not found',
        });
      }

      (client.sendMessage as any)
        .mockResolvedValueOnce({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tool_1', name: 'read_file', input: { path: 'missing.txt' } }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'tool_use',
          usage: { input_tokens: 100, output_tokens: 50 },
        })
        .mockResolvedValueOnce({
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Could not read file' }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          usage: { input_tokens: 120, output_tokens: 30 },
        });

      const result = await runner.run({ task: 'Read missing file' });

      // Workflow continues even with tool errors
      expect(result.status).toBe('completed');
    });
  });

  describe('Test 6: WorkflowResult Data Validation', () => {
    it('should return WorkflowResult with all required fields', async () => {
      const workflow = createTestWorkflow();
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      const result = await runner.run({ task: 'Test task' });

      // Verify all fields are present
      expect(result).toHaveProperty('workflowId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('filesModified');
      expect(result).toHaveProperty('tokenUsage');
      expect(result).toHaveProperty('durationMs');

      // Verify tokenUsage structure
      expect(result.tokenUsage).toHaveProperty('totalInputTokens');
      expect(result.tokenUsage).toHaveProperty('totalOutputTokens');
      expect(result.tokenUsage).toHaveProperty('totalCacheReadTokens');
      expect(result.tokenUsage).toHaveProperty('totalCacheWriteTokens');
      expect(result.tokenUsage).toHaveProperty('totalTokens');
      expect(result.tokenUsage).toHaveProperty('stepCount');

      // Verify values are correct types
      expect(typeof result.workflowId).toBe('string');
      expect(['completed', 'failed']).toContain(result.status);
      expect(typeof result.output).toBe('string');
      expect(Array.isArray(result.filesModified)).toBe(true);
      expect(typeof result.durationMs).toBe('number');
    });

    it('should track token usage correctly across multiple steps', async () => {
      const workflow = createTestWorkflow();
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      // Mock multi-step execution
      (client.sendMessage as any)
        .mockResolvedValueOnce({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tool_1', name: 'read_file', input: {} }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'tool_use',
          usage: { input_tokens: 100, output_tokens: 50 },
        })
        .mockResolvedValueOnce({
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Done' }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          usage: { input_tokens: 150, output_tokens: 30 },
        });

      const result = await runner.run({ task: 'Multi-step task' });

      expect(result.tokenUsage.totalInputTokens).toBe(250); // 100 + 150
      expect(result.tokenUsage.totalOutputTokens).toBe(80); // 50 + 30
      expect(result.tokenUsage.totalTokens).toBe(330); // 250 + 80
      expect(result.tokenUsage.stepCount).toBe(2);
    });
  });

  describe('Test 7: Files Modified Tracking (Optional)', () => {
    it('should return empty filesModified array (MVP implementation)', async () => {
      const workflow = createTestWorkflow();
      const runner = new WorkflowRunner(workflow, client, storage, registry, eventBus);

      const result = await runner.run({ task: 'Test task' });

      expect(result.filesModified).toEqual([]);
    });
  });

  describe('Test 8: Multiple Runs - Session Isolation', () => {
    it('should create separate sessions for each workflow run', async () => {
      // Fresh mocks for this test
      const freshClient = createMockClient();
      const freshStorage = createMockStorage();
      const freshRegistry = createMockRegistry(['read_file', 'write_file']);
      const freshEventBus = createMockEventBus();
      
      const workflow = createTestWorkflow();
      const runner = new WorkflowRunner(workflow, freshClient, freshStorage, freshRegistry, freshEventBus);

      const result1 = await runner.run({ task: 'Task 1' });
      const result2 = await runner.run({ task: 'Task 2' });

      // Verify sessions were created (2 runs × 2 sessions each: workflow + agent-runtime)
      expect(freshStorage.create).toHaveBeenCalledTimes(4);
      
      // Verify workflow sessions were created
      const createCalls = (freshStorage.create as any).mock.calls;
      const workflowSessions = createCalls.filter((call: any) => call[0] === 'workflow-test-workflow');
      expect(workflowSessions).toHaveLength(2);

      // Verify both runs completed independently
      expect(result1.status).toBe('completed');
      expect(result2.status).toBe('completed');

      // Verify separate workflow:start events
      const startEvents = (freshEventBus.emit as any).mock.calls.filter(
        (call: any) => call[0] === 'workflow:start'
      );
      expect(startEvents).toHaveLength(2);

      // Verify session IDs are different
      expect(startEvents[0][1].sessionId).not.toBe(startEvents[1][1].sessionId);
    });

    it('should not leak state between runs', async () => {
      // Fresh mocks for this test
      const freshClient = createMockClient();
      const freshStorage = createMockStorage();
      const freshRegistry = createMockRegistry(['read_file', 'write_file']);
      const freshEventBus = createMockEventBus();
      
      const workflow = createTestWorkflow();
      const runner = new WorkflowRunner(workflow, freshClient, freshStorage, freshRegistry, freshEventBus);

      // Run 1 with specific input
      await runner.run({ task: 'First task', extra: 'data1' });

      // Run 2 with different input
      await runner.run({ task: 'Second task', extra: 'data2' });

      // Verify both runs received correct input context in system prompt
      const systemCalls = (freshClient.sendMessage as any).mock.calls.map((call: any) => call[2].system);

      expect(systemCalls[0]).toContain('data1');
      expect(systemCalls[1]).toContain('data2');

      // Verify no cross-contamination
      expect(systemCalls[0]).not.toContain('data2');
      expect(systemCalls[1]).not.toContain('data1');
    });
  });
});
