// src/tools/__tests__/defaults.test.ts — Integration Tests for Default Tools Registry

import { describe, it, expect, vi } from 'vitest';
import { createDefaultTools } from '../defaults.js';
import { AgentRegistry } from '../../multi-agent/agent-registry.js';
import { MessageBus } from '../../multi-agent/message-bus.js';
import type { LanceDBMemoryStore } from '../../memory/lancedb-store.js';
import type { MemoryEntry, MemoryQuery, MemoryResult } from '../../types/memory.js';

/**
 * Mock MemoryStore for testing
 */
class MockMemoryStore implements Partial<LanceDBMemoryStore> {
  async init(): Promise<void> {}
  async add(entry: any): Promise<MemoryEntry> {
    return {
      id: 'mock-id',
      type: entry.type,
      content: entry.content,
      tags: [],
      source: { type: 'user' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as MemoryEntry;
  }
  async search(query: MemoryQuery): Promise<MemoryResult[]> {
    return [];
  }
  async get(id: string): Promise<MemoryEntry | null> {
    return null;
  }
  async update(id: string, updates: any): Promise<MemoryEntry> {
    throw new Error('Not implemented');
  }
  async delete(id: string): Promise<boolean> {
    return true;
  }
  async list(): Promise<MemoryEntry[]> {
    return [];
  }
  async close(): Promise<void> {}
}

describe('createDefaultTools', () => {
  it('should register all 8 base tools (without optional tools)', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    // Only base tools, no memory or multi-agent tools
    expect(toolNames).toHaveLength(8);
  });

  it('should register all expected tool names', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    const expectedTools = [
      'read_file',
      'write_file',
      'edit_file',
      'exec',
      'list_files',
      'grep',
      'search_code',
      'project_summary',
    ];
    
    for (const toolName of expectedTools) {
      expect(toolNames).toContain(toolName);
    }
  });

  it('should make all tools retrievable via registry.get()', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    for (const name of toolNames) {
      const tool = registry.get(name);
      expect(tool).toBeDefined();
      expect(tool?.name).toBe(name);
    }
  });

  it('should ensure all tools have required properties', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    for (const name of toolNames) {
      const tool = registry.get(name);
      
      expect(tool).toBeDefined();
      expect(tool?.name).toBe(name);
      expect(tool?.description).toBeTruthy();
      expect(typeof tool?.description).toBe('string');
      expect(tool?.inputSchema).toBeDefined();
      expect(typeof tool?.inputSchema).toBe('object');
    }
  });

  it('should register file operation tools', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    const fileOpsTools = ['read_file', 'write_file', 'edit_file'];
    
    for (const toolName of fileOpsTools) {
      expect(toolNames).toContain(toolName);
    }
  });

  it('should register execution tool', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    expect(toolNames).toContain('exec');
  });

  it('should register codebase intelligence tools', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    const codebaseTools = ['list_files', 'grep', 'search_code', 'project_summary'];
    
    for (const toolName of codebaseTools) {
      expect(toolNames).toContain(toolName);
    }
  });

  it('should register memory tools when memoryStore is provided', () => {
    const mockMemoryStore = new MockMemoryStore() as unknown as LanceDBMemoryStore;
    const registry = createDefaultTools({ memoryStore: mockMemoryStore });
    const toolNames = registry.list();
    
    expect(toolNames).toContain('remember');
    expect(toolNames).toContain('recall');
  });

  it('should NOT register memory tools when memoryStore is not provided', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    expect(toolNames).not.toContain('remember');
    expect(toolNames).not.toContain('recall');
  });

  it('should register multi-agent tools when agentRegistry is provided', () => {
    const agentRegistry = new AgentRegistry();
    const registry = createDefaultTools({ agentRegistry });
    const toolNames = registry.list();
    
    expect(toolNames).toContain('spawn_agent');
    expect(toolNames).toContain('list_agents');
  });

  it('should register send_message tool when messageBus is provided', () => {
    const messageBus = new MessageBus();
    const registry = createDefaultTools({ messageBus });
    const toolNames = registry.list();
    
    expect(toolNames).toContain('send_message');
  });

  it('should register all multi-agent tools when both agentRegistry and messageBus are provided', () => {
    const agentRegistry = new AgentRegistry();
    const messageBus = new MessageBus();
    const registry = createDefaultTools({ agentRegistry, messageBus });
    const toolNames = registry.list();
    
    expect(toolNames).toContain('spawn_agent');
    expect(toolNames).toContain('send_message');
    expect(toolNames).toContain('list_agents');
  });

  it('should NOT register multi-agent tools when agentRegistry and messageBus are not provided', () => {
    const registry = createDefaultTools();
    const toolNames = registry.list();
    
    expect(toolNames).not.toContain('spawn_agent');
    expect(toolNames).not.toContain('send_message');
    expect(toolNames).not.toContain('list_agents');
  });

  it('should register all tools (base + memory + multi-agent) when all options are provided', () => {
    const mockMemoryStore = new MockMemoryStore() as unknown as LanceDBMemoryStore;
    const agentRegistry = new AgentRegistry();
    const messageBus = new MessageBus();
    
    const registry = createDefaultTools({
      memoryStore: mockMemoryStore,
      agentRegistry,
      messageBus,
    });
    
    const toolNames = registry.list();
    
    // 8 base tools + 2 memory tools + 3 multi-agent tools = 13 total
    expect(toolNames).toHaveLength(13);
    
    // Verify all tool categories are present
    expect(toolNames).toContain('read_file');
    expect(toolNames).toContain('remember');
    expect(toolNames).toContain('recall');
    expect(toolNames).toContain('spawn_agent');
    expect(toolNames).toContain('send_message');
    expect(toolNames).toContain('list_agents');
  });
});
