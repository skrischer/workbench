// src/runtime/__tests__/git-integration.test.ts — Integration Tests for Git Hooks

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { AgentLoop } from '../agent-loop.js';
import { createGitHooks } from '../git-hooks.js';
import type { Tool, ToolResult, AgentConfig } from '../../types/index.js';
import type { AnthropicClient } from '../../llm/anthropic-client.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { ToolRegistry } from '../../tools/registry.js';

// Helper to initialize a git repo
function initGitRepo(repoPath: string): void {
  execSync('git init', { cwd: repoPath, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: repoPath, stdio: 'ignore' });
  execSync('git config user.name "Test User"', { cwd: repoPath, stdio: 'ignore' });
  
  // Create initial commit
  writeFileSync(join(repoPath, 'README.md'), '# Test Repo\n', 'utf-8');
  execSync('git add .', { cwd: repoPath, stdio: 'ignore' });
  execSync('git commit -m "Initial commit"', { cwd: repoPath, stdio: 'ignore' });
  execSync('git branch -M main', { cwd: repoPath, stdio: 'ignore' });
}

// Mock tool that modifies files in worktree
class MockWriteTool implements Tool {
  name = 'write_file';
  description = 'Write content to a file';
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['path', 'content'],
  };

  constructor(private worktreePath?: string) {}

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const filename = input.path as string;
    const content = input.content as string;
    
    // Write to worktree if provided
    const fullPath = this.worktreePath 
      ? join(this.worktreePath, filename)
      : filename;

    try {
      writeFileSync(fullPath, content, 'utf-8');
      return {
        success: true,
        output: `File written: ${filename}`,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: (error as Error).message,
      };
    }
  }
}

// Mock implementations
const createMockClient = (stopReason: 'end_turn' | 'tool_use' = 'end_turn'): AnthropicClient => ({
  sendMessage: vi.fn().mockResolvedValue({
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: stopReason === 'tool_use'
      ? [
          { type: 'text', text: 'Using write tool' },
          { type: 'tool_use', id: 'tool_1', name: 'write_file', input: { path: 'test.txt', content: 'Test content' } }
        ]
      : [{ type: 'text', text: 'Task completed' }],
    model: 'claude-3-5-sonnet-20241022',
    stop_reason: stopReason,
    usage: { input_tokens: 100, output_tokens: 50 },
  }),
} as any);

const createMockStorage = (): SessionStorage => {
  const sessions = new Map();
  let idCounter = 0;

  return {
    create: vi.fn(async (agentId: string) => {
      const id = `session_${++idCounter}`;
      const session = {
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
    save: vi.fn(async (session: any) => {
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

describe('Git Hooks Integration', () => {
  let tempRepoPath: string;
  let tempWorktreeBase: string;

  beforeEach(() => {
    // Create temp directory for test repo
    tempRepoPath = mkdtempSync(join(tmpdir(), 'test-repo-'));
    initGitRepo(tempRepoPath);

    // Create temp directory for worktrees
    tempWorktreeBase = mkdtempSync(join(tmpdir(), 'test-worktrees-'));
  });

  afterEach(() => {
    // Cleanup temp directories
    if (existsSync(tempRepoPath)) {
      rmSync(tempRepoPath, { recursive: true, force: true });
    }
    if (existsSync(tempWorktreeBase)) {
      rmSync(tempWorktreeBase, { recursive: true, force: true });
    }
  });

  it('should create worktree in onBeforeRun hook', async () => {
    const hooks = createGitHooks({
      repoPath: tempRepoPath,
      baseBranch: 'main',
      worktreeBaseDir: tempWorktreeBase,
      keepWorktree: true,
    });

    const client = createMockClient('end_turn');
    const storage = createMockStorage();
    const registry = { get: vi.fn(() => null), list: vi.fn(() => []) } as any;
    const config: AgentConfig = {
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test',
      maxSteps: 10,
      tools: [],
    };

    const loop = new AgentLoop(client, storage, registry, config, undefined, hooks);

    const result = await loop.run('Test prompt');

    expect(result.status).toBe('completed');
    
    // Check that a worktree was created (should have at least one directory)
    const worktrees = execSync('git worktree list', { cwd: tempRepoPath, encoding: 'utf-8' });
    expect(worktrees).toContain('agent/');
  });

  it('should auto-commit after successful tool execution', async () => {
    let worktreePath: string | undefined;

    // Custom hooks to capture worktree path
    const baseHooks = createGitHooks({
      repoPath: tempRepoPath,
      baseBranch: 'main',
      worktreeBaseDir: tempWorktreeBase,
    });

    const hooks = {
      onBeforeRun: async (session: any) => {
        await baseHooks.onBeforeRun!(session);
        // Extract worktree path from git worktree list
        const worktrees = execSync('git worktree list', { cwd: tempRepoPath, encoding: 'utf-8' });
        const match = worktrees.match(/\/[^\s]+agent-[^\s]+/);
        if (match) {
          worktreePath = match[0];
        }
      },
      onAfterStep: baseHooks.onAfterStep,
      onAfterRun: baseHooks.onAfterRun,
    };

    // Client that triggers tool use, then completes
    const client = createMockClient();
    (client.sendMessage as any)
      .mockResolvedValueOnce({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'write_file', input: { path: 'test.txt', content: 'Hello' } }
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

    const storage = createMockStorage();
    
    // Mock tool that writes to worktree
    const writeTool = new MockWriteTool();
    const registry = {
      get: vi.fn((name: string) => {
        if (name === 'write_file' && worktreePath) {
          return new MockWriteTool(worktreePath);
        }
        return null;
      }),
      list: vi.fn(() => []),
    } as any;

    const config: AgentConfig = {
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test',
      maxSteps: 10,
      tools: ['write_file'],
    };

    const loop = new AgentLoop(client, storage, registry, config, undefined, hooks);

    const result = await loop.run('Write test file');

    expect(result.status).toBe('completed');

    // Check that worktree has commits
    if (worktreePath) {
      const log = execSync('git log --oneline', { cwd: worktreePath, encoding: 'utf-8' });
      expect(log).toContain('Step 1: write_file');
    }
  });

  it('should cleanup worktree after run', async () => {
    const hooks = createGitHooks({
      repoPath: tempRepoPath,
      baseBranch: 'main',
      worktreeBaseDir: tempWorktreeBase,
      keepWorktree: false, // Cleanup after run
    });

    const client = createMockClient('end_turn');
    const storage = createMockStorage();
    const registry = { get: vi.fn(() => null), list: vi.fn(() => []) } as any;
    const config: AgentConfig = {
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test',
      maxSteps: 10,
      tools: [],
    };

    const loop = new AgentLoop(client, storage, registry, config, undefined, hooks);

    // Get initial worktree count
    const beforeWorktrees = execSync('git worktree list', { cwd: tempRepoPath, encoding: 'utf-8' });
    const beforeCount = beforeWorktrees.split('\n').filter(line => line.includes('agent-')).length;

    await loop.run('Test prompt');

    // After run, worktree should be cleaned up
    const afterWorktrees = execSync('git worktree list', { cwd: tempRepoPath, encoding: 'utf-8' });
    const afterCount = afterWorktrees.split('\n').filter(line => line.includes('agent-')).length;

    expect(afterCount).toBe(beforeCount);
  });

  it('should keep worktree if keepWorktree is true', async () => {
    const hooks = createGitHooks({
      repoPath: tempRepoPath,
      baseBranch: 'main',
      worktreeBaseDir: tempWorktreeBase,
      keepWorktree: true, // Keep worktree after run
    });

    const client = createMockClient('end_turn');
    const storage = createMockStorage();
    const registry = { get: vi.fn(() => null), list: vi.fn(() => []) } as any;
    const config: AgentConfig = {
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test',
      maxSteps: 10,
      tools: [],
    };

    const loop = new AgentLoop(client, storage, registry, config, undefined, hooks);

    await loop.run('Test prompt');

    // After run, worktree should still exist
    const afterWorktrees = execSync('git worktree list', { cwd: tempRepoPath, encoding: 'utf-8' });
    const agentWorktrees = afterWorktrees.split('\n').filter(line => line.includes('agent/'));

    expect(agentWorktrees.length).toBeGreaterThan(0);
  });

  it('should return no-op hooks when git is disabled', async () => {
    const hooks = createGitHooks({
      repoPath: tempRepoPath,
      enabled: false, // Explicitly disable
    });

    expect(Object.keys(hooks).length).toBe(0);
  });

  it('should return no-op hooks when .git directory does not exist', async () => {
    const nonGitPath = mkdtempSync(join(tmpdir(), 'non-git-'));

    const hooks = createGitHooks({
      repoPath: nonGitPath,
    });

    expect(Object.keys(hooks).length).toBe(0);

    rmSync(nonGitPath, { recursive: true, force: true });
  });
});
