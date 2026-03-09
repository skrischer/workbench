// src/cli/__tests__/workflow-commands.test.ts — Tests for Workflow Commands

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWorkflowCommands } from '../workflow-commands.js';
import { WorkflowRegistry } from '../../workflows/registry.js';
import { WorkflowRunner } from '../../workflows/runner.js';
import { testFixerWorkflow } from '../../workflows/test-fixer.js';
import { codeReviewerWorkflow } from '../../workflows/code-reviewer.js';
import { refactorWorkflow } from '../../workflows/refactor-agent.js';
import { docsWorkflow } from '../../workflows/docs-agent.js';
import type { AnthropicClient } from '../../llm/anthropic-client.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { ToolRegistry } from '../../tools/registry.js';
import type { TypedEventBus } from '../../events/event-bus.js';
import type { Session, Tool } from '../../types/index.js';

// Mock implementations for WorkflowRunner dependencies
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

const createMockToolRegistry = (): ToolRegistry => {
  const tools = new Map<string, Tool>();
  
  // Register mock default tools
  ['read_file', 'write_file', 'exec'].forEach(name => {
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

describe('createWorkflowCommands', () => {
  it('should return an array with 5 commands', () => {
    const commands = createWorkflowCommands();
    
    expect(commands).toBeInstanceOf(Array);
    expect(commands.length).toBe(6);
    
    // Verify command names
    const commandNames = commands.map(cmd => cmd.name());
    expect(commandNames).toContain('fix-tests');
    expect(commandNames).toContain('review');
    expect(commandNames).toContain('refactor');
    expect(commandNames).toContain('docs');
    expect(commandNames).toContain('workflows');
  });
  
  it('fix-tests command should have correct options', () => {
    const commands = createWorkflowCommands();
    const fixTestsCmd = commands.find(cmd => cmd.name() === 'fix-tests');
    
    expect(fixTestsCmd).toBeDefined();
    
    // Check options
    const options = fixTestsCmd!.options;
    const optionNames = options.map(opt => opt.long);
    
    expect(optionNames).toContain('--filter');
    expect(optionNames).toContain('--max-attempts');
    
    // Verify option details
    const filterOption = options.find(opt => opt.long === '--filter');
    expect(filterOption?.description).toBeDefined();
    
    const maxAttemptsOption = options.find(opt => opt.long === '--max-attempts');
    expect(maxAttemptsOption?.description).toBeDefined();
  });
  
  it('review command should have required argument <branch>', () => {
    const commands = createWorkflowCommands();
    const reviewCmd = commands.find(cmd => cmd.name() === 'review');
    
    expect(reviewCmd).toBeDefined();
    
    // Check that it has at least one argument
    const args = reviewCmd!.registeredArguments;
    expect(args.length).toBeGreaterThan(0);
    
    // First argument should be required
    const branchArg = args[0];
    expect(branchArg.required).toBe(true);
    expect(branchArg.name()).toBe('branch');
  });
  
  it('refactor command should have required argument <target> and --type option', () => {
    const commands = createWorkflowCommands();
    const refactorCmd = commands.find(cmd => cmd.name() === 'refactor');
    
    expect(refactorCmd).toBeDefined();
    
    // Check required argument
    const args = refactorCmd!.registeredArguments;
    expect(args.length).toBeGreaterThan(0);
    
    const targetArg = args[0];
    expect(targetArg.required).toBe(true);
    expect(targetArg.name()).toBe('target');
    
    // Check --type option
    const options = refactorCmd!.options;
    const typeOption = options.find(opt => opt.long === '--type');
    
    expect(typeOption).toBeDefined();
    expect(typeOption?.required).toBe(true);
  });
  
  it('docs command should have --type option', () => {
    const commands = createWorkflowCommands();
    const docsCmd = commands.find(cmd => cmd.name() === 'docs');
    
    expect(docsCmd).toBeDefined();
    
    // Check --type option
    const options = docsCmd!.options;
    const typeOption = options.find(opt => opt.long === '--type');
    
    expect(typeOption).toBeDefined();
    expect(typeOption?.required).toBe(true);
  });
});

describe('WorkflowRunner with new API', () => {
  let client: AnthropicClient;
  let storage: SessionStorage;
  let toolRegistry: ToolRegistry;
  let eventBus: TypedEventBus;

  beforeEach(() => {
    client = createMockClient();
    storage = createMockStorage();
    toolRegistry = createMockToolRegistry();
    eventBus = createMockEventBus();
    vi.clearAllMocks();
  });

  it('should return failed result for invalid input', async () => {
    const registry = new WorkflowRegistry();
    registry.register(testFixerWorkflow);
    
    const definition = registry.get('test-fixer');
    expect(definition).toBeDefined();
    
    const runner = new WorkflowRunner(
      definition!,
      client,
      storage,
      toolRegistry,
      eventBus
    );
    
    // testFixerWorkflow requires 'testCommand' parameter
    const result = await runner.run({}); // Missing required testCommand
    
    expect(result.status).toBe('failed');
    expect(result.output).toContain('Input validation failed');
  });
  
  it('should list all 4 workflows from registry', () => {
    const registry = new WorkflowRegistry();
    registry.register(testFixerWorkflow);
    registry.register(codeReviewerWorkflow);
    registry.register(refactorWorkflow);
    registry.register(docsWorkflow);
    
    // Use registry.list() instead of runner.listWorkflows()
    const workflows = registry.list();
    
    expect(workflows.length).toBe(4);
    
    // Verify workflow IDs
    const workflowIds = workflows.map((w: any) => w.id);
    expect(workflowIds).toContain('test-fixer');
    expect(workflowIds).toContain('code-reviewer');
    expect(workflowIds).toContain('refactor');
    expect(workflowIds).toContain('docs');
    
    // Verify structure
    workflows.forEach((workflow: any) => {
      expect(workflow).toHaveProperty('id');
      expect(workflow).toHaveProperty('name');
      expect(workflow).toHaveProperty('description');
      expect(typeof workflow.id).toBe('string');
      expect(typeof workflow.name).toBe('string');
      expect(typeof workflow.description).toBe('string');
    });
  });

  it('should return undefined for non-existent workflow', () => {
    const registry = new WorkflowRegistry();
    
    const definition = registry.get('non-existent-workflow');
    
    expect(definition).toBeUndefined();
  });
});
