// src/runtime/__tests__/input-validation.test.ts — Input Validation Integration Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentLoop } from '../agent-loop.js';
import type { Tool, ToolResult } from '../../types/index.js';
import type { AnthropicClient } from '../../llm/anthropic-client.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { ToolRegistry } from '../../tools/registry.js';
import type { TypedEventBus } from '../../events/event-bus.js';

// Mock tool with strict input schema
class MockCalculatorTool implements Tool {
  name = 'calculator';
  description = 'Perform basic calculations';
  inputSchema = {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
      a: { type: 'number' },
      b: { type: 'number' },
    },
    required: ['operation', 'a', 'b'],
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const { operation, a, b } = input as { operation: string; a: number; b: number };
    let result: number;

    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        result = a / b;
        break;
      default:
        return { success: false, output: '', error: 'Invalid operation' };
    }

    return { success: true, output: `Result: ${result}` };
  }
}

// Mock tool with optional parameters
class MockGreeterTool implements Tool {
  name = 'greet';
  description = 'Greet a person';
  inputSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      greeting: { type: 'string' },
    },
    required: ['name'],
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const { name, greeting = 'Hello' } = input as { name: string; greeting?: string };
    return { success: true, output: `${greeting}, ${name}!` };
  }
}

// Mock dependencies
class MockToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }
}

class MockSessionStorage {
  async create(): Promise<any> {
    return { id: 'test-session' };
  }
  async load(): Promise<any> {
    return { id: 'test-session', messages: [] };
  }
  async save(): Promise<void> {}
  async addMessage(): Promise<void> {}
  async getMessages(): Promise<any[]> {
    return [];
  }
  async updateMetadata(): Promise<void> {}
  async clearSession(): Promise<void> {}
}

class MockAnthropicClient {
  async sendMessage(): Promise<any> {
    throw new Error('Not implemented for validation tests');
  }
}

describe('Input Validation Integration', () => {
  let agentLoop: AgentLoop;
  let toolRegistry: MockToolRegistry;

  beforeEach(() => {
    toolRegistry = new MockToolRegistry();
    const storage = new MockSessionStorage();
    const client = new MockAnthropicClient();

    agentLoop = new AgentLoop(
      client as any,
      storage as any,
      toolRegistry as any,
      { 
        model: 'claude-3-5-sonnet-20241022', 
        maxSteps: 10,
        systemPrompt: 'Test agent for input validation'
      }
    );

    // Register test tools
    toolRegistry.register(new MockCalculatorTool());
    toolRegistry.register(new MockGreeterTool());
  });

  it('should pass valid input through to tool execution', async () => {
    const toolUse = {
      type: 'tool_use' as const,
      id: 'test-1',
      name: 'calculator',
      input: {
        operation: 'add',
        a: 5,
        b: 3,
      },
    };

    const result = await (agentLoop as any).executeTool.call(agentLoop, toolUse);

    expect(result.type).toBe('tool_result');
    expect(result.tool_use_id).toBe('test-1');
    expect(result.is_error).toBe(false);
    expect(result.content).toBe('Result: 8');
  });

  it('should return error result when required field is missing', async () => {
    const toolUse = {
      type: 'tool_use' as const,
      id: 'test-2',
      name: 'calculator',
      input: {
        operation: 'add',
        a: 5,
        // b is missing
      },
    };

    const result = await (agentLoop as any).executeTool(toolUse);

    expect(result.type).toBe('tool_result');
    expect(result.tool_use_id).toBe('test-2');
    expect(result.is_error).toBe(true);
    expect(result.content).toContain('Input validation failed');
    expect(result.content).toContain("must have required property 'b'");
  });

  it('should return error result when field has wrong type', async () => {
    const executeTool = (agentLoop as any).executeTool.bind(agentLoop);

    const toolUse = {
      type: 'tool_use' as const,
      id: 'test-3',
      name: 'calculator',
      input: {
        operation: 'add',
        a: 'not-a-number', // Should be number
        b: 3,
      },
    };

    const result = await executeTool(toolUse);

    expect(result.type).toBe('tool_result');
    expect(result.tool_use_id).toBe('test-3');
    expect(result.is_error).toBe(true);
    expect(result.content).toContain('Input validation failed');
    expect(result.content).toContain('/a');
    expect(result.content).toContain('must be number');
  });

  it('should return error result with multiple validation errors', async () => {
    const executeTool = (agentLoop as any).executeTool.bind(agentLoop);

    const toolUse = {
      type: 'tool_use' as const,
      id: 'test-4',
      name: 'calculator',
      input: {
        operation: 'invalid-op', // Invalid enum value
        a: 'not-a-number', // Wrong type
        // b is missing
      },
    };

    const result = await executeTool(toolUse);

    expect(result.type).toBe('tool_result');
    expect(result.tool_use_id).toBe('test-4');
    expect(result.is_error).toBe(true);
    expect(result.content).toContain('Input validation failed');
    // Should contain multiple error messages
    const lines = result.content.split('\n');
    expect(lines.length).toBeGreaterThan(2); // Header + at least 2 error lines
  });

  it('should still handle tool-not-found error correctly', async () => {
    const executeTool = (agentLoop as any).executeTool.bind(agentLoop);

    const toolUse = {
      type: 'tool_use' as const,
      id: 'test-5',
      name: 'nonexistent_tool',
      input: {},
    };

    const result = await executeTool(toolUse);

    expect(result.type).toBe('tool_result');
    expect(result.tool_use_id).toBe('test-5');
    expect(result.is_error).toBe(true);
    expect(result.content).toContain('Tool "nonexistent_tool" not found');
  });

  it('should validate optional parameters when provided', async () => {
    const executeTool = (agentLoop as any).executeTool.bind(agentLoop);

    // Valid with optional parameter
    const toolUse1 = {
      type: 'tool_use' as const,
      id: 'test-6a',
      name: 'greet',
      input: {
        name: 'Alice',
        greeting: 'Hi',
      },
    };

    const result1 = await executeTool(toolUse1);
    expect(result1.is_error).toBe(false);
    expect(result1.content).toBe('Hi, Alice!');

    // Invalid type for optional parameter
    const toolUse2 = {
      type: 'tool_use' as const,
      id: 'test-6b',
      name: 'greet',
      input: {
        name: 'Bob',
        greeting: 123, // Should be string
      },
    };

    const result2 = await executeTool(toolUse2);
    expect(result2.is_error).toBe(true);
    expect(result2.content).toContain('Input validation failed');
    expect(result2.content).toContain('/greeting');
  });

  it('should allow valid input without optional parameters', async () => {
    const executeTool = (agentLoop as any).executeTool.bind(agentLoop);

    const toolUse = {
      type: 'tool_use' as const,
      id: 'test-7',
      name: 'greet',
      input: {
        name: 'Charlie',
        // greeting is optional, not provided
      },
    };

    const result = await executeTool(toolUse);

    expect(result.type).toBe('tool_result');
    expect(result.tool_use_id).toBe('test-7');
    expect(result.is_error).toBe(false);
    expect(result.content).toBe('Hello, Charlie!');
  });
});
