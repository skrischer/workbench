// src/runtime/__tests__/agent-loop-consolidated.test.ts — Tests for consolidated AgentLoop with hooks

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentLoop, type AgentLoopHooks } from '../agent-loop.js';
import { createGitHooks, type GitHooksConfig } from '../git-hooks.js';
import type { AgentConfig, Session, RunResult, ToolResult } from '../../types/index.js';
import type { AnthropicClient } from '../../llm/anthropic-client.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { ToolRegistry } from '../../tools/registry.js';
import type { TypedEventBus } from '../../events/event-bus.js';

// Mock implementations
const createMockClient = (): AnthropicClient => ({
  sendMessage: vi.fn().mockResolvedValue({
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Test response' }],
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

const createMockRegistry = (): ToolRegistry => ({
  get: vi.fn(() => null),
  register: vi.fn(),
  list: vi.fn(() => []),
} as any);

const createMockEventBus = (): TypedEventBus => ({
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
} as any);

const defaultConfig: AgentConfig = {
  model: 'claude-3-5-sonnet-20241022',
  systemPrompt: 'You are a helpful assistant.',
  maxSteps: 10,
  tools: [],
};

describe('AgentLoop - Consolidated with Hooks', () => {
  let client: AnthropicClient;
  let storage: SessionStorage;
  let registry: ToolRegistry;
  let eventBus: TypedEventBus;

  beforeEach(() => {
    client = createMockClient();
    storage = createMockStorage();
    registry = createMockRegistry();
    eventBus = createMockEventBus();
    vi.clearAllMocks();
  });

  describe('Test 1: Basic Loop without Hooks', () => {
    it('should run without hooks and complete successfully', async () => {
      const loop = new AgentLoop(client, storage, registry, defaultConfig, eventBus);

      const result = await loop.run('Hello, world!');

      expect(result.status).toBe('completed');
      expect(result.finalResponse).toBe('Test response');
      expect(result.steps).toBe(1);
      expect(result.tokenUsage.input_tokens).toBe(100);
      expect(result.tokenUsage.output_tokens).toBe(50);
      expect(storage.create).toHaveBeenCalledWith('agent-runtime');
      expect(eventBus.emit).toHaveBeenCalledWith('run:start', expect.any(Object));
      expect(eventBus.emit).toHaveBeenCalledWith('run:end', expect.any(Object));
    });

    it('should handle max steps reached', async () => {
      const shortConfig: AgentConfig = { ...defaultConfig, maxSteps: 1 };
      const loopingClient = createMockClient();
      (loopingClient.sendMessage as any).mockResolvedValue({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Still working...' },
          { type: 'tool_use', id: 'tool_1', name: 'test_tool', input: {} },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'tool_use',
        usage: { input_tokens: 100, output_tokens: 50 },
      });

      const loop = new AgentLoop(loopingClient, storage, registry, shortConfig, eventBus);

      const result = await loop.run('Complex task');

      expect(result.status).toBe('max_steps_reached');
      expect(result.steps).toBe(1);
    });
  });

  describe('Test 2: Loop with Custom Hooks', () => {
    it('should call all lifecycle hooks in correct order', async () => {
      const hookCalls: string[] = [];

      const hooks: AgentLoopHooks = {
        onBeforeRun: vi.fn(async (session: Session) => {
          hookCalls.push('onBeforeRun');
          expect(session.id).toBeDefined();
        }),
        onAfterStep: vi.fn(async (step: ToolResult, context: any) => {
          hookCalls.push('onAfterStep');
          expect(context.runId).toBeDefined();
          expect(context.toolName).toBeDefined();
        }),
        onAfterRun: vi.fn(async (result: RunResult, context: any) => {
          hookCalls.push('onAfterRun');
          expect(result.status).toBe('completed');
          expect(context.runId).toBeDefined();
        }),
      };

      // Configure client to trigger tool use
      (client.sendMessage as any)
        .mockResolvedValueOnce({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Using tool' },
            { type: 'tool_use', id: 'tool_1', name: 'test_tool', input: {} },
          ],
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
          usage: { input_tokens: 50, output_tokens: 25 },
        });

      // Mock tool in registry
      (registry.get as any).mockReturnValue({
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: { type: 'object', properties: {} },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'Tool result' }),
      });

      const loop = new AgentLoop(client, storage, registry, defaultConfig, eventBus, hooks);

      const result = await loop.run('Test with hooks');

      expect(result.status).toBe('completed');
      expect(hookCalls).toEqual(['onBeforeRun', 'onAfterStep', 'onAfterRun']);
      expect(hooks.onBeforeRun).toHaveBeenCalledTimes(1);
      expect(hooks.onAfterStep).toHaveBeenCalledTimes(1);
      expect(hooks.onAfterRun).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test 3: Hook Error Handling', () => {
    it('should handle onBeforeRun hook error gracefully', async () => {
      const hooks: AgentLoopHooks = {
        onBeforeRun: vi.fn().mockRejectedValue(new Error('Hook initialization failed')),
      };

      const loop = new AgentLoop(client, storage, registry, defaultConfig, eventBus, hooks);

      const result = await loop.run('Test');

      expect(result.status).toBe('failed');
      expect(result.finalResponse).toContain('Hook initialization failed');
      expect(hooks.onBeforeRun).toHaveBeenCalledTimes(1);
    });

    it('should handle onAfterStep hook error and continue', async () => {
      const hooks: AgentLoopHooks = {
        onAfterStep: vi.fn().mockRejectedValue(new Error('Step hook failed')),
        onAfterRun: vi.fn(), // Should still be called
      };

      // Configure client to trigger tool use
      (client.sendMessage as any)
        .mockResolvedValueOnce({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool_1', name: 'test_tool', input: {} },
          ],
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
          usage: { input_tokens: 50, output_tokens: 25 },
        });

      (registry.get as any).mockReturnValue({
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: { type: 'object', properties: {} },
        execute: vi.fn().mockResolvedValue({ success: true, output: 'Tool result' }),
      });

      const loop = new AgentLoop(client, storage, registry, defaultConfig, eventBus, hooks);

      // Should throw because onAfterStep fails
      await expect(loop.run('Test')).rejects.toThrow('Step hook failed');
      expect(hooks.onAfterStep).toHaveBeenCalledTimes(1);
    });

    it('should call onAfterRun even on run failure', async () => {
      const hooks: AgentLoopHooks = {
        onAfterRun: vi.fn(),
      };

      // Make client throw error
      (client.sendMessage as any).mockRejectedValue(new Error('LLM API failed'));

      const loop = new AgentLoop(client, storage, registry, defaultConfig, eventBus, hooks);

      const result = await loop.run('Test');

      expect(result.status).toBe('failed');
      expect(hooks.onAfterRun).toHaveBeenCalledTimes(1);
      expect(hooks.onAfterRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
        expect.objectContaining({ runId: expect.any(String) })
      );
    });
  });

  describe('Test 4: onBeforeRun Hook', () => {
    it('should receive session context in onBeforeRun', async () => {
      let capturedSession: Session | undefined;

      const hooks: AgentLoopHooks = {
        onBeforeRun: vi.fn(async (session: Session) => {
          capturedSession = session;
        }),
      };

      const loop = new AgentLoop(client, storage, registry, defaultConfig, eventBus, hooks);

      await loop.run('Test prompt');

      expect(capturedSession).toBeDefined();
      expect(capturedSession!.id).toBeDefined();
      expect(capturedSession!.agentId).toBe('agent-runtime');
      expect(capturedSession!.messages.length).toBeGreaterThan(0);
      expect(capturedSession!.messages[0].role).toBe('user');
      expect(capturedSession!.messages[0].content).toBe('Test prompt');
    });
  });

  describe('Test 5: onAfterStep Hook', () => {
    it('should receive tool result and context in onAfterStep', async () => {
      let capturedStep: ToolResult | undefined;
      let capturedContext: any;

      const hooks: AgentLoopHooks = {
        onAfterStep: vi.fn(async (step: ToolResult, context: any) => {
          capturedStep = step;
          capturedContext = context;
        }),
      };

      (client.sendMessage as any)
        .mockResolvedValueOnce({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool_1', name: 'calculator', input: { a: 1, b: 2 } },
          ],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'tool_use',
          usage: { input_tokens: 100, output_tokens: 50 },
        })
        .mockResolvedValueOnce({
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Result is 3' }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          usage: { input_tokens: 50, output_tokens: 25 },
        });

      (registry.get as any).mockReturnValue({
        name: 'calculator',
        description: 'Calculate sum',
        inputSchema: { type: 'object', properties: {} },
        execute: vi.fn().mockResolvedValue({ success: true, output: '3' }),
      });

      const loop = new AgentLoop(client, storage, registry, defaultConfig, eventBus, hooks);

      await loop.run('Calculate 1 + 2');

      expect(capturedStep).toBeDefined();
      expect(capturedStep!.success).toBe(true);
      expect(capturedStep!.output).toBe('3');
      expect(capturedContext.runId).toBeDefined();
      expect(capturedContext.stepIndex).toBe(1);
      expect(capturedContext.toolName).toBe('calculator');
    });

    it('should skip onAfterStep for failed tool executions', async () => {
      const hooks: AgentLoopHooks = {
        onAfterStep: vi.fn(),
      };

      (client.sendMessage as any)
        .mockResolvedValueOnce({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'tool_1', name: 'broken_tool', input: {} },
          ],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'tool_use',
          usage: { input_tokens: 100, output_tokens: 50 },
        })
        .mockResolvedValueOnce({
          id: 'msg_2',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Tool failed' }],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          usage: { input_tokens: 50, output_tokens: 25 },
        });

      (registry.get as any).mockReturnValue({
        name: 'broken_tool',
        description: 'Broken tool',
        inputSchema: { type: 'object', properties: {} },
        execute: vi.fn().mockResolvedValue({ success: false, error: 'Tool error' }),
      });

      const loop = new AgentLoop(client, storage, registry, defaultConfig, eventBus, hooks);

      await loop.run('Use broken tool');

      // Hook should NOT be called for failed tool execution
      expect(hooks.onAfterStep).not.toHaveBeenCalled();
    });
  });

  describe('Test 6: onAfterRun Hook', () => {
    it('should receive final result and context in onAfterRun', async () => {
      let capturedResult: RunResult | undefined;
      let capturedContext: any;

      const hooks: AgentLoopHooks = {
        onAfterRun: vi.fn(async (result: RunResult, context: any) => {
          capturedResult = result;
          capturedContext = context;
        }),
      };

      const loop = new AgentLoop(client, storage, registry, defaultConfig, eventBus, hooks);

      await loop.run('Final test');

      expect(capturedResult).toBeDefined();
      expect(capturedResult!.status).toBe('completed');
      expect(capturedResult!.sessionId).toBeDefined();
      expect(capturedResult!.steps).toBe(1);
      expect(capturedResult!.finalResponse).toBe('Test response');
      expect(capturedResult!.tokenUsage.input_tokens).toBe(100);
      expect(capturedContext.runId).toBe(capturedResult!.sessionId);
    });
  });

  describe('Test 7: createGitHooks Factory (without actual Git)', () => {
    it('should return no-op hooks when Git is disabled', () => {
      const hooks = createGitHooks({
        repoPath: '/nonexistent/repo',
        enabled: false,
      });

      expect(hooks).toBeDefined();
      expect(hooks.onBeforeRun).toBeUndefined();
      expect(hooks.onAfterStep).toBeUndefined();
      expect(hooks.onAfterRun).toBeUndefined();
    });

    it('should return no-op hooks when .git directory does not exist', () => {
      const hooks = createGitHooks({
        repoPath: '/tmp/no-git-here',
      });

      expect(hooks).toBeDefined();
      // Should be empty object (no-op)
      expect(Object.keys(hooks).length).toBe(0);
    });
  });

  describe('Test 8: Backward Compatibility with CoreAgentLoop', () => {
    it('should support CoreAgentLoop as alias for AgentLoop', async () => {
      const { CoreAgentLoop } = await import('../core-agent-loop.js');

      const loop = new CoreAgentLoop(client, storage, registry, defaultConfig, eventBus);

      const result = await loop.run('Test backward compatibility');

      expect(result.status).toBe('completed');
      expect(result.finalResponse).toBe('Test response');
    });
  });
});
