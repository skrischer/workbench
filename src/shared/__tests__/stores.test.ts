// src/shared/__tests__/stores.test.ts — Zustand Store Unit Tests

import { describe, it, expect, beforeEach } from 'vitest';
import type { StoreApi } from 'zustand/vanilla';
import { createSessionStore } from '../stores/session-store.js';
import { createChatStore } from '../stores/chat-store.js';
import { createRunStore } from '../stores/run-store.js';
import type { SessionStore } from '../stores/session-store.js';
import type { ChatStore } from '../stores/chat-store.js';
import type { RunStore } from '../stores/run-store.js';
import type { SessionPreview, ChatMessage, ToolCallState } from '../types/ui.js';

// ─── SessionStore ───────────────────────────────────────────

describe('sessionStore', () => {
  let store: StoreApi<SessionStore>;

  beforeEach(() => {
    store = createSessionStore();
  });

  const makePreview = (id: string, overrides?: Partial<SessionPreview>): SessionPreview => ({
    id,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    messageCount: 0,
    promptPreview: '',
    ...overrides,
  });

  it('has correct initial state', () => {
    const state = store.getState();
    expect(state.sessions).toEqual([]);
    expect(state.activeId).toBeNull();
    expect(state.filter).toBe('');
    expect(state.isLoading).toBe(false);
  });

  describe('setActive', () => {
    it('sets the active session id', () => {
      store.getState().setActive('s1');
      expect(store.getState().activeId).toBe('s1');
    });

    it('clears the active session id with null', () => {
      store.getState().setActive('s1');
      store.getState().setActive(null);
      expect(store.getState().activeId).toBeNull();
    });
  });

  describe('setSessions', () => {
    it('replaces the sessions array', () => {
      const sessions = [makePreview('s1'), makePreview('s2')];
      store.getState().setSessions(sessions);
      expect(store.getState().sessions).toHaveLength(2);
      expect(store.getState().sessions[0].id).toBe('s1');
      expect(store.getState().sessions[1].id).toBe('s2');
    });

    it('overwrites previous sessions', () => {
      store.getState().setSessions([makePreview('s1')]);
      store.getState().setSessions([makePreview('s2')]);
      expect(store.getState().sessions).toHaveLength(1);
      expect(store.getState().sessions[0].id).toBe('s2');
    });
  });

  describe('addSession', () => {
    it('prepends a session to the list', () => {
      store.getState().setSessions([makePreview('s1')]);
      store.getState().addSession(makePreview('s2'));
      const sessions = store.getState().sessions;
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('s2');
      expect(sessions[1].id).toBe('s1');
    });
  });

  describe('updateSession', () => {
    it('updates a specific session by id', () => {
      store.getState().setSessions([
        makePreview('s1', { messageCount: 0 }),
        makePreview('s2', { messageCount: 0 }),
      ]);
      store.getState().updateSession('s1', { messageCount: 5 });

      const sessions = store.getState().sessions;
      expect(sessions[0].messageCount).toBe(5);
      expect(sessions[1].messageCount).toBe(0);
    });

    it('does not affect other sessions', () => {
      store.getState().setSessions([makePreview('s1'), makePreview('s2')]);
      store.getState().updateSession('s1', { promptPreview: 'updated' });

      expect(store.getState().sessions[1].promptPreview).toBe('');
    });
  });

  describe('setFilter', () => {
    it('sets the filter string', () => {
      store.getState().setFilter('test');
      expect(store.getState().filter).toBe('test');
    });

    it('can clear the filter', () => {
      store.getState().setFilter('test');
      store.getState().setFilter('');
      expect(store.getState().filter).toBe('');
    });
  });

  describe('setLoading', () => {
    it('sets the loading state', () => {
      store.getState().setLoading(true);
      expect(store.getState().isLoading).toBe(true);

      store.getState().setLoading(false);
      expect(store.getState().isLoading).toBe(false);
    });
  });
});

// ─── ChatStore ──────────────────────────────────────────────

describe('chatStore', () => {
  let store: StoreApi<ChatStore>;

  beforeEach(() => {
    store = createChatStore();
  });

  const makeMessage = (content: string, role: ChatMessage['role'] = 'user'): ChatMessage => ({
    role,
    content,
    timestamp: '2026-01-01T00:00:00Z',
  });

  it('has correct initial state', () => {
    const state = store.getState();
    expect(state.messages.size).toBe(0);
    expect(state.streamingText).toBe('');
    expect(state.streamingToolCalls.size).toBe(0);
  });

  describe('addMessage', () => {
    it('adds a message to a new session', () => {
      store.getState().addMessage('s1', makeMessage('hello'));
      const msgs = store.getState().messages.get('s1');
      expect(msgs).toHaveLength(1);
      expect(msgs![0].content).toBe('hello');
    });

    it('appends messages to an existing session', () => {
      store.getState().addMessage('s1', makeMessage('first'));
      store.getState().addMessage('s1', makeMessage('second'));
      const msgs = store.getState().messages.get('s1');
      expect(msgs).toHaveLength(2);
      expect(msgs![0].content).toBe('first');
      expect(msgs![1].content).toBe('second');
    });

    it('keeps messages from different sessions separate', () => {
      store.getState().addMessage('s1', makeMessage('msg-s1'));
      store.getState().addMessage('s2', makeMessage('msg-s2'));
      expect(store.getState().messages.get('s1')).toHaveLength(1);
      expect(store.getState().messages.get('s2')).toHaveLength(1);
    });
  });

  describe('setMessages', () => {
    it('replaces all messages for a session', () => {
      store.getState().addMessage('s1', makeMessage('old'));
      store.getState().setMessages('s1', [makeMessage('new1'), makeMessage('new2')]);
      const msgs = store.getState().messages.get('s1');
      expect(msgs).toHaveLength(2);
      expect(msgs![0].content).toBe('new1');
    });

    it('does not affect other sessions', () => {
      store.getState().addMessage('s1', makeMessage('s1-msg'));
      store.getState().setMessages('s2', [makeMessage('s2-msg')]);
      expect(store.getState().messages.get('s1')).toHaveLength(1);
    });
  });

  describe('appendStreamDelta', () => {
    it('appends text to streamingText', () => {
      store.getState().appendStreamDelta('Hello');
      store.getState().appendStreamDelta(' World');
      expect(store.getState().streamingText).toBe('Hello World');
    });
  });

  describe('resetStreaming', () => {
    it('clears streamingText and streamingToolCalls', () => {
      store.getState().appendStreamDelta('partial text');
      store.getState().setToolCallStart('t1', 'read_file');
      store.getState().resetStreaming();

      expect(store.getState().streamingText).toBe('');
      expect(store.getState().streamingToolCalls.size).toBe(0);
    });
  });

  describe('setToolCallStart', () => {
    it('creates a new tool call entry with running status', () => {
      store.getState().setToolCallStart('t1', 'read_file');
      const tc = store.getState().streamingToolCalls.get('t1');
      expect(tc).toBeDefined();
      expect(tc!.toolId).toBe('t1');
      expect(tc!.toolName).toBe('read_file');
      expect(tc!.input).toBe('');
      expect(tc!.status).toBe('running');
    });
  });

  describe('appendToolInput', () => {
    it('appends input delta to an existing tool call', () => {
      store.getState().setToolCallStart('t1', 'read_file');
      store.getState().appendToolInput('t1', '{"path":');
      store.getState().appendToolInput('t1', '"test.ts"}');
      const tc = store.getState().streamingToolCalls.get('t1');
      expect(tc!.input).toBe('{"path":"test.ts"}');
    });

    it('does nothing for a non-existent tool call', () => {
      store.getState().appendToolInput('nonexistent', 'data');
      expect(store.getState().streamingToolCalls.has('nonexistent')).toBe(false);
    });
  });

  describe('setToolResult', () => {
    it('sets result and status for a successful tool call', () => {
      store.getState().setToolCallStart('t1', 'read_file');
      store.getState().setToolResult('t1', 'file contents', 150, false);
      const tc = store.getState().streamingToolCalls.get('t1');
      expect(tc!.result).toBe('file contents');
      expect(tc!.durationMs).toBe(150);
      expect(tc!.status).toBe('success');
    });

    it('sets error status when isError is true', () => {
      store.getState().setToolCallStart('t1', 'exec');
      store.getState().setToolResult('t1', 'permission denied', 50, true);
      const tc = store.getState().streamingToolCalls.get('t1');
      expect(tc!.status).toBe('error');
      expect(tc!.result).toBe('permission denied');
    });

    it('does nothing for a non-existent tool call', () => {
      store.getState().setToolResult('nonexistent', 'result', 100, false);
      expect(store.getState().streamingToolCalls.has('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes messages for the given session', () => {
      store.getState().addMessage('s1', makeMessage('msg'));
      store.getState().addMessage('s2', makeMessage('msg'));
      store.getState().clear('s1');

      expect(store.getState().messages.has('s1')).toBe(false);
      expect(store.getState().messages.has('s2')).toBe(true);
    });
  });
});

// ─── RunStore ───────────────────────────────────────────────

describe('runStore', () => {
  let store: StoreApi<RunStore>;

  beforeEach(() => {
    store = createRunStore();
  });

  it('has correct initial state', () => {
    const state = store.getState();
    expect(state.activeRunId).toBeNull();
    expect(state.isRunning).toBe(false);
    expect(state.tokenUsage).toEqual({ input: 0, output: 0 });
    expect(state.stepCount).toBe(0);
    expect(state.model).toBe('');
  });

  describe('setRunning', () => {
    it('sets run as active with id and model', () => {
      store.getState().setRunning('run-1', 'claude-3-opus');
      const state = store.getState();
      expect(state.activeRunId).toBe('run-1');
      expect(state.isRunning).toBe(true);
      expect(state.model).toBe('claude-3-opus');
      expect(state.tokenUsage).toEqual({ input: 0, output: 0 });
      expect(state.stepCount).toBe(0);
    });

    it('defaults model to empty string when not provided', () => {
      store.getState().setRunning('run-1');
      expect(store.getState().model).toBe('');
    });

    it('resets token usage and step count when starting a new run', () => {
      store.getState().setRunning('run-1');
      store.getState().updateTokens(100, 50);
      store.getState().incrementStep();

      store.getState().setRunning('run-2', 'claude-3');
      expect(store.getState().tokenUsage).toEqual({ input: 0, output: 0 });
      expect(store.getState().stepCount).toBe(0);
    });
  });

  describe('setEnded', () => {
    it('clears running state and active run id', () => {
      store.getState().setRunning('run-1', 'claude-3');
      store.getState().setEnded();

      expect(store.getState().isRunning).toBe(false);
      expect(store.getState().activeRunId).toBeNull();
    });

    it('preserves token usage and step count after ending', () => {
      store.getState().setRunning('run-1');
      store.getState().updateTokens(100, 50);
      store.getState().incrementStep();
      store.getState().setEnded();

      expect(store.getState().tokenUsage).toEqual({ input: 100, output: 50 });
      expect(store.getState().stepCount).toBe(1);
    });
  });

  describe('updateTokens', () => {
    it('accumulates token usage', () => {
      store.getState().setRunning('run-1');
      store.getState().updateTokens(100, 50);
      store.getState().updateTokens(200, 80);
      expect(store.getState().tokenUsage).toEqual({ input: 300, output: 130 });
    });
  });

  describe('incrementStep', () => {
    it('increments the step count', () => {
      store.getState().setRunning('run-1');
      store.getState().incrementStep();
      store.getState().incrementStep();
      store.getState().incrementStep();
      expect(store.getState().stepCount).toBe(3);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      store.getState().setRunning('run-1', 'claude-3');
      store.getState().updateTokens(500, 200);
      store.getState().incrementStep();
      store.getState().incrementStep();

      store.getState().reset();

      const state = store.getState();
      expect(state.activeRunId).toBeNull();
      expect(state.isRunning).toBe(false);
      expect(state.tokenUsage).toEqual({ input: 0, output: 0 });
      expect(state.stepCount).toBe(0);
      expect(state.model).toBe('');
    });
  });
});
