// src/git/__tests__/branch-guard.test.ts — Tests for Branch Guard module

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isProtectedBranch,
  assertOnAgentBranch,
  wrapTool,
  DEFAULT_PROTECTED_BRANCHES,
} from '../branch-guard.js';
import type { Tool, ToolResult } from '../../types/index.js';

// Mock getCurrentBranch from git-utils
vi.mock('../git-utils.js', () => ({
  getCurrentBranch: vi.fn(),
}));

import { getCurrentBranch } from '../git-utils.js';

describe('Branch Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isProtectedBranch()', () => {
    it('should identify default protected branches', () => {
      expect(isProtectedBranch('main')).toBe(true);
      expect(isProtectedBranch('master')).toBe(true);
      expect(isProtectedBranch('develop')).toBe(true);
    });

    it('should match glob patterns for release and hotfix branches', () => {
      expect(isProtectedBranch('release/1.0')).toBe(true);
      expect(isProtectedBranch('release/2.5.3')).toBe(true);
      expect(isProtectedBranch('hotfix/urgent')).toBe(true);
      expect(isProtectedBranch('hotfix/critical-bug')).toBe(true);
    });

    it('should return false for agent branches', () => {
      expect(isProtectedBranch('agent/feature-123')).toBe(false);
      expect(isProtectedBranch('agent/bugfix')).toBe(false);
      expect(isProtectedBranch('agent/test')).toBe(false);
    });

    it('should return false for feature branches', () => {
      expect(isProtectedBranch('feature/new-feature')).toBe(false);
      expect(isProtectedBranch('feature/bar')).toBe(false);
    });

    it('should support custom protected branch patterns', () => {
      const customPatterns = ['production', 'staging', 'deploy/*'];
      
      expect(isProtectedBranch('production', customPatterns)).toBe(true);
      expect(isProtectedBranch('staging', customPatterns)).toBe(true);
      expect(isProtectedBranch('deploy/v1', customPatterns)).toBe(true);
      expect(isProtectedBranch('deploy/prod', customPatterns)).toBe(true);
      expect(isProtectedBranch('agent/test', customPatterns)).toBe(false);
    });

    it('should handle complex glob patterns', () => {
      const patterns = ['prod-*', 'live/*', 'stable'];
      
      expect(isProtectedBranch('prod-east', patterns)).toBe(true);
      expect(isProtectedBranch('prod-west', patterns)).toBe(true);
      expect(isProtectedBranch('live/eu', patterns)).toBe(true);
      expect(isProtectedBranch('stable', patterns)).toBe(true);
      expect(isProtectedBranch('dev', patterns)).toBe(false);
    });

    it('should handle empty patterns array', () => {
      expect(isProtectedBranch('main', [])).toBe(false);
      expect(isProtectedBranch('agent/test', [])).toBe(false);
    });
  });

  describe('assertOnAgentBranch()', () => {
    it('should throw on protected branch (main)', () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'main',
      });

      expect(() => assertOnAgentBranch()).toThrow(
        "Branch guard violation: Current branch 'main' does not have 'agent/' prefix"
      );
    });

    it('should throw on protected branch (release/*)', () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'release/1.0',
      });

      expect(() => assertOnAgentBranch()).toThrow(
        "Branch guard violation: Current branch 'release/1.0' does not have 'agent/' prefix"
      );
    });

    it('should throw on non-agent feature branch', () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'feature/new-feature',
      });

      expect(() => assertOnAgentBranch()).toThrow(
        "Branch guard violation: Current branch 'feature/new-feature' does not have 'agent/' prefix"
      );
    });

    it('should pass on agent/* branch', () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'agent/feature-123',
      });

      expect(() => assertOnAgentBranch()).not.toThrow();
    });

    it('should pass on different agent/* branches', () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'agent/bugfix-456',
      });

      expect(() => assertOnAgentBranch()).not.toThrow();

      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'agent/test',
      });

      expect(() => assertOnAgentBranch()).not.toThrow();
    });

    it('should throw when getCurrentBranch fails', () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: false,
        error: 'Not a git repository',
      });

      expect(() => assertOnAgentBranch()).toThrow(
        'Failed to get current branch: Not a git repository'
      );
    });

    it('should throw when getCurrentBranch returns no data', () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: false,
        data: undefined,
      });

      expect(() => assertOnAgentBranch()).toThrow(
        'Failed to get current branch: Unknown error'
      );
    });

    it('should pass cwd parameter to getCurrentBranch', () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'agent/test',
      });

      assertOnAgentBranch('/test/path');

      expect(getCurrentBranch).toHaveBeenCalledWith('/test/path');
    });
  });

  describe('wrapTool()', () => {
    const mockTool: Tool = {
      name: 'testTool',
      description: 'A test tool',
      inputSchema: { type: 'object' },
      execute: vi.fn(async () => ({
        success: true,
        output: 'Tool executed',
      })),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should block tool execution on protected branch (main)', async () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'main',
      });

      const wrapped = wrapTool(mockTool);
      const result = await wrapped.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot execute 'testTool' on protected branch 'main'");
      expect(result.error).toContain('File-modifying operations are only allowed on agent branches');
      expect(mockTool.execute).not.toHaveBeenCalled();
    });

    it('should block tool execution on protected branch (release/*)', async () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'release/2.0',
      });

      const wrapped = wrapTool(mockTool);
      const result = await wrapped.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot execute 'testTool' on protected branch 'release/2.0'");
      expect(mockTool.execute).not.toHaveBeenCalled();
    });

    it('should block tool execution on non-agent feature branch', async () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'feature/new-thing',
      });

      const wrapped = wrapTool(mockTool);
      const result = await wrapped.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot execute 'testTool' on branch 'feature/new-thing'");
      expect(mockTool.execute).not.toHaveBeenCalled();
    });

    it('should allow tool execution on agent/* branch', async () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'agent/feature-123',
      });

      const wrapped = wrapTool(mockTool);
      const result = await wrapped.execute({ test: 'input' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Tool executed');
      expect(mockTool.execute).toHaveBeenCalledWith({ test: 'input' });
    });

    it('should allow tool execution on different agent/* branches', async () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'agent/bugfix-456',
      });

      const wrapped = wrapTool(mockTool);
      const result = await wrapped.execute({});

      expect(result.success).toBe(true);
      expect(mockTool.execute).toHaveBeenCalled();
    });

    it('should bypass guard when config.enabled is false', async () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'main',
      });

      const wrapped = wrapTool(mockTool, { enabled: false });
      const result = await wrapped.execute({ test: 'data' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Tool executed');
      expect(mockTool.execute).toHaveBeenCalledWith({ test: 'data' });
      expect(getCurrentBranch).not.toHaveBeenCalled();
    });

    it('should return error result when getCurrentBranch fails', async () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: false,
        error: 'Not a git repository',
      });

      const wrapped = wrapTool(mockTool);
      const result = await wrapped.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Branch guard: Failed to get current branch');
      expect(result.error).toContain('Not a git repository');
      expect(mockTool.execute).not.toHaveBeenCalled();
    });

    it('should return error result when getCurrentBranch returns no data', async () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: undefined,
      });

      const wrapped = wrapTool(mockTool);
      const result = await wrapped.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Branch guard: Failed to get current branch');
      expect(mockTool.execute).not.toHaveBeenCalled();
    });

    it('should respect custom protected branches config', async () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'production',
      });

      const wrapped = wrapTool(mockTool, {
        protectedBranches: ['production', 'staging'],
      });
      const result = await wrapped.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot execute 'testTool' on protected branch 'production'");
      expect(mockTool.execute).not.toHaveBeenCalled();
    });

    it('should pass cwd to getCurrentBranch', async () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'agent/test',
      });

      const wrapped = wrapTool(mockTool, { cwd: '/custom/path' });
      await wrapped.execute({});

      expect(getCurrentBranch).toHaveBeenCalledWith('/custom/path');
    });

    it('should preserve tool metadata', () => {
      const wrapped = wrapTool(mockTool);

      expect(wrapped.name).toBe(mockTool.name);
      expect(wrapped.description).toBe(mockTool.description);
      expect(wrapped.inputSchema).toBe(mockTool.inputSchema);
    });

    it('should handle tool execution errors', async () => {
      vi.mocked(getCurrentBranch).mockReturnValue({
        success: true,
        data: 'agent/test',
      });

      const errorTool: Tool = {
        name: 'errorTool',
        description: 'A tool that errors',
        inputSchema: { type: 'object' },
        execute: vi.fn(async () => ({
          success: false,
          output: '',
          error: 'Tool execution failed',
        })),
      };

      const wrapped = wrapTool(errorTool);
      const result = await wrapped.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool execution failed');
    });
  });
});
