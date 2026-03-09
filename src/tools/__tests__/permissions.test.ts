// src/tools/__tests__/permissions.test.ts — PermissionGuard Tests

import { describe, it, expect } from 'vitest';
import { PermissionGuard, PermissionError } from '../permissions.js';
import { resolve } from 'node:path';

describe('PermissionGuard', () => {
  it('should allow path that matches exact pattern', () => {
    const guard = new PermissionGuard(['/tmp/workbench/**']);
    expect(guard.isPathAllowed('/tmp/workbench/file.txt')).toBe(true);
  });

  it('should deny path that does not match any pattern', () => {
    const guard = new PermissionGuard(['/tmp/workbench/**']);
    expect(guard.isPathAllowed('/home/user/file.txt')).toBe(false);
  });

  it('should support glob patterns with wildcard', () => {
    const guard = new PermissionGuard(['/tmp/workbench-*/**']);
    expect(guard.isPathAllowed('/tmp/workbench-123/file.txt')).toBe(true);
    expect(guard.isPathAllowed('/tmp/workbench-abc/nested/file.txt')).toBe(true);
    expect(guard.isPathAllowed('/tmp/other/file.txt')).toBe(false);
  });

  it('should allow nested paths within allowed directory', () => {
    const guard = new PermissionGuard(['/home/user/project/**']);
    expect(guard.isPathAllowed('/home/user/project/src/main.ts')).toBe(true);
    expect(guard.isPathAllowed('/home/user/project/deep/nested/path/file.txt')).toBe(true);
  });

  it('should allow all paths when no patterns are configured', () => {
    const guard = new PermissionGuard([]);
    expect(guard.isPathAllowed('/any/path/file.txt')).toBe(true);
    expect(guard.isPathAllowed('/tmp/test.txt')).toBe(true);
  });

  it('should resolve relative paths before checking', () => {
    const guard = new PermissionGuard([resolve(process.cwd(), 'allowed/**')]);
    expect(guard.isPathAllowed('allowed/file.txt')).toBe(true);
    expect(guard.isPathAllowed('./allowed/nested/file.txt')).toBe(true);
  });

  it('should support multiple patterns', () => {
    const guard = new PermissionGuard(['/tmp/workbench/**', '/home/user/project/**']);
    expect(guard.isPathAllowed('/tmp/workbench/file.txt')).toBe(true);
    expect(guard.isPathAllowed('/home/user/project/file.txt')).toBe(true);
    expect(guard.isPathAllowed('/other/path/file.txt')).toBe(false);
  });

  it('should throw PermissionError when checkPath fails', () => {
    const guard = new PermissionGuard(['/tmp/allowed/**']);
    
    expect(() => {
      guard.checkPath('/tmp/forbidden/file.txt');
    }).toThrow(PermissionError);
  });

  it('should include path details in PermissionError', () => {
    const guard = new PermissionGuard(['/tmp/allowed/**']);
    
    try {
      guard.checkPath('/tmp/forbidden/file.txt');
      expect.fail('Should have thrown PermissionError');
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionError);
      const permError = error as PermissionError;
      expect(permError.path).toBe(resolve('/tmp/forbidden/file.txt'));
      expect(permError.allowedPaths).toEqual([resolve('/tmp/allowed/**')]);
      expect(permError.message).toContain('/tmp/forbidden/file.txt');
    }
  });

  it('should not throw when checkPath succeeds', () => {
    const guard = new PermissionGuard(['/tmp/allowed/**']);
    
    expect(() => {
      guard.checkPath('/tmp/allowed/file.txt');
    }).not.toThrow();
  });

  it('should return allowed patterns', () => {
    const patterns = ['/tmp/workbench/**', '/home/user/**'];
    const guard = new PermissionGuard(patterns);
    const returned = guard.getAllowedPatterns();
    
    expect(returned).toHaveLength(2);
    expect(returned[0]).toBe(resolve('/tmp/workbench/**'));
    expect(returned[1]).toBe(resolve('/home/user/**'));
  });

  it('should handle edge case: root path with pattern', () => {
    const guard = new PermissionGuard(['/**']);
    expect(guard.isPathAllowed('/any/path/anywhere.txt')).toBe(true);
  });

  it('should handle edge case: single file pattern', () => {
    const guard = new PermissionGuard(['/tmp/specific-file.txt']);
    expect(guard.isPathAllowed('/tmp/specific-file.txt')).toBe(true);
    expect(guard.isPathAllowed('/tmp/other-file.txt')).toBe(false);
  });
});
