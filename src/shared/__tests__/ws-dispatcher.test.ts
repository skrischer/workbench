// src/shared/__tests__/ws-dispatcher.test.ts — WS Dispatcher event routing tests

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWsDispatcher } from '../ws-client/use-ws-dispatcher.js';
import type { ServerMessage, WsEventMessage } from '../../types/ws-protocol.js';
import type { ChatStore } from '../stores/chat-store.js';
import type { RunStore } from '../stores/run-store.js';

function createMockChatStore(): ChatStore {
  return {
    messages: new Map(),
    streamingText: '',
    streamingToolCalls: new Map(),
    addMessage: vi.fn(),
    setMessages: vi.fn(),
    appendStreamDelta: vi.fn(),
    resetStreaming: vi.fn(),
    setToolCallStart: vi.fn(),
    appendToolInput: vi.fn(),
    setToolResult: vi.fn(),
    clear: vi.fn(),
  };
}

function createMockRunStore(): RunStore {
  return {
    activeRunId: null,
    isRunning: false,
    tokenUsage: { input: 0, output: 0 },
    stepCount: 0,
    model: '',
    setRunning: vi.fn(),
    setEnded: vi.fn(),
    updateTokens: vi.fn(),
    incrementStep: vi.fn(),
    reset: vi.fn(),
  };
}

function makeEventMsg(event: string, data: Record<string, unknown>): WsEventMessage {
  return { type: 'event', event, data } as unknown as WsEventMessage;
}

describe('useWsDispatcher', () => {
  let chatStore: ChatStore;
  let runStore: RunStore;

  beforeEach(() => {
    chatStore = createMockChatStore();
    runStore = createMockRunStore();
  });

  function renderDispatcher(lastMessage: ServerMessage | null) {
    return renderHook(
      ({ msg }) => useWsDispatcher(msg, { chatStore, runStore }),
      { initialProps: { msg: lastMessage } },
    );
  }

  it('ignores null messages', () => {
    renderDispatcher(null);
    expect(chatStore.addMessage).not.toHaveBeenCalled();
    expect(runStore.setRunning).not.toHaveBeenCalled();
  });

  it('ignores response messages', () => {
    const msg: ServerMessage = { type: 'response', requestId: 'r1', data: {} };
    renderDispatcher(msg);
    expect(chatStore.addMessage).not.toHaveBeenCalled();
  });

  it('routes session:message to chatStore.addMessage', () => {
    const msg = makeEventMsg('session:message', {
      sessionId: 's1',
      message: { role: 'user', content: 'hello', timestamp: '2026-01-01T00:00:00Z' },
    });

    renderDispatcher(msg);

    expect(chatStore.addMessage).toHaveBeenCalledWith('s1', {
      role: 'user',
      content: 'hello',
      toolCallId: undefined,
      timestamp: '2026-01-01T00:00:00Z',
    });
  });

  it('converts system role to assistant in session:message', () => {
    const msg = makeEventMsg('session:message', {
      sessionId: 's1',
      message: { role: 'system', content: 'sys msg', timestamp: '2026-01-01T00:00:00Z' },
    });

    renderDispatcher(msg);

    expect(chatStore.addMessage).toHaveBeenCalledWith('s1', expect.objectContaining({
      role: 'assistant',
    }));
  });

  it('routes run:start to runStore.setRunning', () => {
    const msg = makeEventMsg('run:start', {
      runId: 'r1',
      agentConfig: { model: 'claude-3-opus', systemPrompt: 's', maxSteps: 10 },
      prompt: 'test',
    });

    renderDispatcher(msg);

    expect(runStore.setRunning).toHaveBeenCalledWith('r1', 'claude-3-opus');
  });

  it('routes run:end to runStore.setEnded', () => {
    const msg = makeEventMsg('run:end', {
      runId: 'r1',
      result: 'done',
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    renderDispatcher(msg);

    expect(runStore.setEnded).toHaveBeenCalled();
  });

  it('routes run:step to runStore.incrementStep', () => {
    const msg = makeEventMsg('run:step', {
      runId: 'r1',
      stepIndex: 0,
      message: { role: 'assistant', content: 'step', timestamp: '2026-01-01T00:00:00Z' },
    });

    renderDispatcher(msg);

    expect(runStore.incrementStep).toHaveBeenCalled();
  });

  it('routes llm:stream:delta to chatStore.appendStreamDelta', () => {
    const msg = makeEventMsg('llm:stream:delta', {
      runId: 'r1',
      text: 'Hello ',
    });

    renderDispatcher(msg);

    expect(chatStore.appendStreamDelta).toHaveBeenCalledWith('Hello ');
  });

  it('routes llm:stream:tool_start to chatStore.setToolCallStart', () => {
    const msg = makeEventMsg('llm:stream:tool_start', {
      runId: 'r1',
      toolName: 'read_file',
      toolId: 't1',
    });

    renderDispatcher(msg);

    expect(chatStore.setToolCallStart).toHaveBeenCalledWith('t1', 'read_file');
  });

  it('routes llm:stream:tool_input to chatStore.appendToolInput', () => {
    const msg = makeEventMsg('llm:stream:tool_input', {
      runId: 'r1',
      toolId: 't1',
      inputDelta: '{"path":"test.ts"}',
    });

    renderDispatcher(msg);

    expect(chatStore.appendToolInput).toHaveBeenCalledWith('t1', '{"path":"test.ts"}');
  });

  it('routes llm:response to runStore.updateTokens', () => {
    const msg = makeEventMsg('llm:response', {
      runId: 'r1',
      model: 'claude-3',
      tokenUsage: { inputTokens: 200, outputTokens: 100 },
    });

    renderDispatcher(msg);

    expect(runStore.updateTokens).toHaveBeenCalledWith(200, 100);
  });

  it('routes tool:call to chatStore.setToolCallStart with synthetic id', () => {
    const msg = makeEventMsg('tool:call', {
      runId: 'r1',
      toolName: 'write_file',
      input: { path: 'a.ts', content: 'x' },
      stepIndex: 2,
    });

    renderDispatcher(msg);

    expect(chatStore.setToolCallStart).toHaveBeenCalledWith('r1-2-write_file', 'write_file');
  });

  it('routes tool:result to chatStore.setToolResult (success)', () => {
    const msg = makeEventMsg('tool:result', {
      runId: 'r1',
      toolName: 'read_file',
      result: { success: true, output: 'file contents' },
      durationMs: 150,
    });

    renderDispatcher(msg);

    expect(chatStore.setToolResult).toHaveBeenCalledWith('read_file', 'file contents', 150, false);
  });

  it('routes tool:result to chatStore.setToolResult (error)', () => {
    const msg = makeEventMsg('tool:result', {
      runId: 'r1',
      toolName: 'exec',
      result: { success: false, output: '', error: 'permission denied' },
      durationMs: 50,
    });

    renderDispatcher(msg);

    expect(chatStore.setToolResult).toHaveBeenCalledWith('exec', 'permission denied', 50, true);
  });

  it('silently ignores unhandled event types', () => {
    const msg = makeEventMsg('agent:spawned', {
      id: 'a1',
      role: 'worker',
      sessionId: 's1',
    });

    // Should not throw
    expect(() => renderDispatcher(msg)).not.toThrow();
  });

  it('reacts to message changes via rerender', () => {
    const msg1 = makeEventMsg('run:start', {
      runId: 'r1',
      agentConfig: { model: 'm1', systemPrompt: 's', maxSteps: 5 },
      prompt: 'p',
    });

    const { rerender } = renderDispatcher(msg1);
    expect(runStore.setRunning).toHaveBeenCalledTimes(1);

    const msg2 = makeEventMsg('run:end', {
      runId: 'r1',
      result: 'done',
      tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    rerender({ msg: msg2 });
    expect(runStore.setEnded).toHaveBeenCalledTimes(1);
  });
});
