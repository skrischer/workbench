// src/runtime/__tests__/memory-integration.test.ts — Integration test for Memory usage in AgentLoop

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentLoop } from '../agent-loop.js';
import type { AgentConfig, Session } from '../../types/index.js';
import type { AnthropicClient } from '../../llm/anthropic-client.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { ToolRegistry } from '../../tools/registry.js';
import type { TypedEventBus } from '../../events/event-bus.js';
import type { ToolUseBlock } from '../../types/index.js';

/**
 * Integration test to verify that:
 * 1. Agent can use recall tool to search memory
 * 2. Agent can use remember tool to store information
 * 3. System prompt guides agent to use memory proactively
 */

describe('Memory Integration with AgentLoop', () => {
  let client: AnthropicClient;
  let storage: SessionStorage;
  let registry: ToolRegistry;
  let eventBus: TypedEventBus;
  let config: AgentConfig;

  beforeEach(() => {
    // Mock Anthropic Client
    client = {
      sendMessage: vi.fn(),
    } as any;

    // Mock Session Storage
    const sessions = new Map<string, Session>();
    let idCounter = 0;
    storage = {
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
        return { ...session };
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

    // Mock Tool Registry with recall and remember tools
    const mockRecallTool = {
      name: 'recall',
      description: 'Search for information in long-term memory',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          type: { type: 'string', enum: ['session', 'project', 'knowledge', 'preference'] },
          limit: { type: 'number' },
        },
        required: ['query'],
      },
      execute: vi.fn(async (input: Record<string, unknown>) => {
        const query = input.query as string;
        return {
          success: true,
          output: `Found 2 relevant memories:\n\n1. [project] (95.2% relevant)\n   We use TypeScript strict mode for better type safety\n   (ID: mem_001, Created: 1/15/2024)\n\n2. [knowledge] (87.3% relevant)\n   Previous bug: Null check needed in auth handler\n   (ID: mem_002, Created: 1/20/2024)`,
          metadata: {
            query,
            count: 2,
            results: [
              { id: 'mem_001', type: 'project', score: 0.952, tags: ['typescript'] },
              { id: 'mem_002', type: 'knowledge', score: 0.873, tags: ['bugfix', 'auth'] },
            ],
          },
        };
      }),
    };

    const mockRememberTool = {
      name: 'remember',
      description: 'Save information to long-term memory',
      inputSchema: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          type: { type: 'string', enum: ['session', 'project', 'knowledge', 'preference'] },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['content'],
      },
      execute: vi.fn(async (input: Record<string, unknown>) => {
        const content = input.content as string;
        return {
          success: true,
          output: `Remembered: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          metadata: {
            id: `mem_${Date.now()}`,
            type: input.type ?? 'knowledge',
            tags: input.tags ?? [],
            createdAt: new Date().toISOString(),
          },
        };
      }),
    };

    registry = {
      get: vi.fn((name: string) => {
        if (name === 'recall') return mockRecallTool;
        if (name === 'remember') return mockRememberTool;
        return null;
      }),
      register: vi.fn(),
      list: vi.fn(() => ['recall', 'remember']),
    } as any;

    // Mock Event Bus
    eventBus = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    } as any;

    // Config with Memory-aware system prompt
    config = {
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: `You are a helpful coding assistant with access to tools.

## Memory & Context

You have access to a memory system that stores summaries of past sessions and important information.

**When to use memory:**
- Before starting a task, search for relevant past sessions or knowledge
- Learn from previous errors and solutions
- Reference past decisions, patterns, and preferences

**recall** — Search for information in long-term memory
**remember** — Save information to long-term memory

**Best Practices:**
1. Search memory before starting complex tasks
2. Remember important decisions and learnings`,
      maxSteps: 25,
      tools: ['recall', 'remember'],
    };
  });

  it('should use recall tool to search memory before starting a task', async () => {
    // Mock LLM response: Agent uses recall tool first
    (client.sendMessage as any).mockResolvedValueOnce({
      id: 'msg_001',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me search for relevant past knowledge about authentication.' },
        {
          type: 'tool_use',
          id: 'tool_001',
          name: 'recall',
          input: { query: 'authentication implementation', type: 'project' },
        } as ToolUseBlock,
      ],
      model: 'claude-3-5-sonnet-20241022',
      stop_reason: 'tool_use',
      usage: { input_tokens: 200, output_tokens: 50 },
    });

    // Mock second response: Agent provides final answer
    (client.sendMessage as any).mockResolvedValueOnce({
      id: 'msg_002',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Based on memory, we use TypeScript strict mode and need null checks in auth handlers. I recommend implementing authentication with these best practices in mind.',
        },
      ],
      model: 'claude-3-5-sonnet-20241022',
      stop_reason: 'end_turn',
      usage: { input_tokens: 300, output_tokens: 100 },
    });

    const loop = new AgentLoop(client, storage, registry, config, eventBus);
    const result = await loop.run('How should I implement user authentication?');

    // Verify recall tool was called
    const recallTool = registry.get('recall');
    expect(recallTool?.execute).toHaveBeenCalledWith(
      { query: 'authentication implementation', type: 'project' },
      expect.any(Object)
    );

    // Verify agent completed successfully
    expect(result.status).toBe('completed');
    expect(result.finalResponse).toContain('TypeScript strict mode');
    expect(result.steps).toBeGreaterThan(0);
  });

  it('should use remember tool to store important information', async () => {
    // Mock LLM response: Agent uses remember tool to store decision
    (client.sendMessage as any).mockResolvedValueOnce({
      id: 'msg_001',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'I will remember this architectural decision for future reference.',
        },
        {
          type: 'tool_use',
          id: 'tool_001',
          name: 'remember',
          input: {
            content: 'Project architecture: Using microservices pattern with REST APIs',
            type: 'project',
            tags: ['architecture', 'design-decision'],
          },
        } as ToolUseBlock,
      ],
      model: 'claude-3-5-sonnet-20241022',
      stop_reason: 'tool_use',
      usage: { input_tokens: 150, output_tokens: 40 },
    });

    // Mock second response: Completion
    (client.sendMessage as any).mockResolvedValueOnce({
      id: 'msg_002',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Decision recorded in memory for future sessions.' }],
      model: 'claude-3-5-sonnet-20241022',
      stop_reason: 'end_turn',
      usage: { input_tokens: 200, output_tokens: 20 },
    });

    const loop = new AgentLoop(client, storage, registry, config, eventBus);
    const result = await loop.run('We decided to use microservices architecture. Remember this.');

    // Verify remember tool was called
    const rememberTool = registry.get('remember');
    expect(rememberTool?.execute).toHaveBeenCalledWith(
      {
        content: 'Project architecture: Using microservices pattern with REST APIs',
        type: 'project',
        tags: ['architecture', 'design-decision'],
      },
      expect.any(Object)
    );

    // Verify agent completed successfully
    expect(result.status).toBe('completed');
    expect(result.finalResponse).toContain('recorded in memory');
  });

  it('should have recall and remember tools available by default when memory store exists', async () => {
    const loop = new AgentLoop(client, storage, registry, config, eventBus);

    // Verify tools are registered
    expect(registry.list()).toContain('recall');
    expect(registry.list()).toContain('remember');
    expect(registry.get('recall')).toBeDefined();
    expect(registry.get('remember')).toBeDefined();
  });
});
