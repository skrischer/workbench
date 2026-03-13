// src/server/__tests__/command-handler.test.ts — Command Handler Unit Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCommand } from '../command-handler.js';
import type { WsCommandMessage } from '../../types/ws-protocol.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { AgentLoop } from '../../runtime/agent-loop.js';
import type { WebSocket } from 'ws';

// Helpers to create mock dependencies
function createMockSocket(): WebSocket {
  return {
    readyState: 1, // WebSocket.OPEN
    send: vi.fn(),
  } as unknown as WebSocket;
}

function createMockSessionStorage(): SessionStorage {
  return {
    list: vi.fn(),
    load: vi.fn(),
    create: vi.fn(),
    createSession: vi.fn(),
  } as unknown as SessionStorage;
}

function createMockAgentLoop(): AgentLoop {
  return {
    runStreaming: vi.fn().mockResolvedValue({ result: 'done' }),
    cancel: vi.fn(),
  } as unknown as AgentLoop;
}

function parseSentMessage(socket: WebSocket): Record<string, unknown> {
  const sendFn = socket.send as ReturnType<typeof vi.fn>;
  const lastCall = sendFn.mock.calls[sendFn.mock.calls.length - 1];
  return JSON.parse(lastCall[0] as string) as Record<string, unknown>;
}

describe('handleCommand', () => {
  let socket: WebSocket;
  let sessionStorage: SessionStorage;
  let agentLoop: AgentLoop;

  beforeEach(() => {
    socket = createMockSocket();
    sessionStorage = createMockSessionStorage();
    agentLoop = createMockAgentLoop();
  });

  function makeMsg(
    command: string,
    payload?: unknown,
    requestId?: string,
  ): WsCommandMessage {
    return {
      type: 'command',
      command: command as WsCommandMessage['command'],
      requestId,
      payload,
    };
  }

  describe('list_sessions', () => {
    it('calls sessionStorage.list and sends result', async () => {
      const sessionData = [{ id: 's1', agentId: 'a1', status: 'active', createdAt: '', updatedAt: '', messageCount: 0, promptPreview: '' }];
      const mockResult = {
        data: sessionData,
        total: 1,
        offset: 0,
        limit: 50,
      };
      (sessionStorage.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await handleCommand(makeMsg('list_sessions', undefined, 'req-1'), {
        sessionStorage,
        agentLoop,
        socket,
      });

      expect(sessionStorage.list).toHaveBeenCalledWith({ limit: 50, sort: 'desc' });
      const response = parseSentMessage(socket);
      expect(response).toEqual({
        type: 'response',
        requestId: 'req-1',
        data: sessionData,
      });
    });
  });

  describe('load_session', () => {
    it('calls sessionStorage.load with the given id', async () => {
      const mockSession = { id: 's1', agentId: 'a1', messages: [], status: 'active' };
      (sessionStorage.load as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      await handleCommand(makeMsg('load_session', { id: 's1' }, 'req-2'), {
        sessionStorage,
        agentLoop,
        socket,
      });

      expect(sessionStorage.load).toHaveBeenCalledWith('s1');
      const response = parseSentMessage(socket);
      expect(response).toEqual({
        type: 'response',
        requestId: 'req-2',
        data: mockSession,
      });
    });
  });

  describe('create_session', () => {
    it('calls sessionStorage.createSession and returns the new session', async () => {
      const mockSession = {
        id: 's-new',
        agentId: 'default',
        messages: [],
        toolCalls: [],
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      (sessionStorage.createSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

      await handleCommand(makeMsg('create_session', undefined, 'req-3'), {
        sessionStorage,
        agentLoop,
        socket,
      });

      expect(sessionStorage.createSession).toHaveBeenCalled();
      const response = parseSentMessage(socket);
      expect(response).toEqual({
        type: 'response',
        requestId: 'req-3',
        data: mockSession,
      });
    });
  });

  describe('send_message', () => {
    it('calls agentLoop.runStreaming and returns started status', async () => {
      await handleCommand(
        makeMsg('send_message', { sessionId: 's1', prompt: 'Hello!' }, 'req-4'),
        { sessionStorage, agentLoop, socket },
      );

      expect(agentLoop.runStreaming).toHaveBeenCalledWith('Hello!', 's1');
      const response = parseSentMessage(socket);
      expect(response).toEqual({
        type: 'response',
        requestId: 'req-4',
        data: { status: 'started' },
      });
    });
  });

  describe('abort_run', () => {
    it('calls agentLoop.cancel and returns aborted status', async () => {
      (agentLoop.cancel as ReturnType<typeof vi.fn>).mockReturnValue(true);

      await handleCommand(
        makeMsg('abort_run', { runId: 'run-1' }, 'req-5'),
        { sessionStorage, agentLoop, socket },
      );

      expect(agentLoop.cancel).toHaveBeenCalledWith('run-1');
      const response = parseSentMessage(socket);
      expect(response).toEqual({
        type: 'response',
        requestId: 'req-5',
        data: { aborted: true },
      });
    });

    it('returns aborted: false when run not found', async () => {
      (agentLoop.cancel as ReturnType<typeof vi.fn>).mockReturnValue(false);

      await handleCommand(
        makeMsg('abort_run', { runId: 'nonexistent' }, 'req-6'),
        { sessionStorage, agentLoop, socket },
      );

      const response = parseSentMessage(socket);
      expect(response).toEqual({
        type: 'response',
        requestId: 'req-6',
        data: { aborted: false },
      });
    });
  });

  describe('search_sessions', () => {
    it('calls sessionStorage.list and filters results by query', async () => {
      const mockResult = {
        data: [
          { id: 'session-abc', agentId: 'agent-1', status: 'active', createdAt: '', updatedAt: '', messageCount: 2 },
          { id: 'session-xyz', agentId: 'agent-2', status: 'active', createdAt: '', updatedAt: '', messageCount: 1 },
        ],
        total: 2,
        offset: 0,
        limit: 20,
      };
      (sessionStorage.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await handleCommand(
        makeMsg('search_sessions', { query: 'abc' }, 'req-7'),
        { sessionStorage, agentLoop, socket },
      );

      expect(sessionStorage.list).toHaveBeenCalledWith({ limit: 20, sort: 'desc' });
      const response = parseSentMessage(socket);
      expect(response).toMatchObject({
        type: 'response',
        requestId: 'req-7',
      });
      const data = response.data as Array<{ id: string }>;
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('session-abc');
    });

    it('returns all sessions when query is empty', async () => {
      const mockResult = {
        data: [
          { id: 's1', agentId: 'a1', status: 'active', createdAt: '', updatedAt: '', messageCount: 0 },
        ],
        total: 1,
        offset: 0,
        limit: 20,
      };
      (sessionStorage.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await handleCommand(
        makeMsg('search_sessions', { query: '' }, 'req-8'),
        { sessionStorage, agentLoop, socket },
      );

      const response = parseSentMessage(socket);
      const data = response.data as Array<{ id: string }>;
      expect(data).toHaveLength(1);
    });

    it('uses custom limit when provided', async () => {
      const mockResult = { data: [], total: 0, offset: 0, limit: 5 };
      (sessionStorage.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await handleCommand(
        makeMsg('search_sessions', { query: 'test', limit: 5 }, 'req-9'),
        { sessionStorage, agentLoop, socket },
      );

      expect(sessionStorage.list).toHaveBeenCalledWith({ limit: 5, sort: 'desc' });
    });

    it('filters by agentId as well', async () => {
      const mockResult = {
        data: [
          { id: 's1', agentId: 'coder', status: 'active', createdAt: '', updatedAt: '', messageCount: 0 },
          { id: 's2', agentId: 'reviewer', status: 'active', createdAt: '', updatedAt: '', messageCount: 0 },
        ],
        total: 2,
        offset: 0,
        limit: 20,
      };
      (sessionStorage.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await handleCommand(
        makeMsg('search_sessions', { query: 'coder' }, 'req-10'),
        { sessionStorage, agentLoop, socket },
      );

      const response = parseSentMessage(socket);
      const data = response.data as Array<{ agentId: string }>;
      expect(data).toHaveLength(1);
      expect(data[0].agentId).toBe('coder');
    });
  });

  describe('unknown command', () => {
    it('sends error response for unknown commands', async () => {
      await handleCommand(
        makeMsg('nonexistent_command', undefined, 'req-err'),
        { sessionStorage, agentLoop, socket },
      );

      const response = parseSentMessage(socket);
      expect(response).toMatchObject({
        type: 'response',
        requestId: 'req-err',
        data: null,
        error: {
          code: 'COMMAND_ERROR',
          message: 'Unknown command: nonexistent_command',
        },
      });
    });
  });

  describe('fire-and-forget (no requestId)', () => {
    it('executes command without sending a response', async () => {
      const mockResult = { data: [], total: 0, offset: 0, limit: 50 };
      (sessionStorage.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await handleCommand(makeMsg('list_sessions'), {
        sessionStorage,
        agentLoop,
        socket,
      });

      expect(sessionStorage.list).toHaveBeenCalled();
      expect(socket.send).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('sends error response when a command throws', async () => {
      (sessionStorage.load as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Session not found'),
      );

      await handleCommand(makeMsg('load_session', { id: 'bad-id' }, 'req-err2'), {
        sessionStorage,
        agentLoop,
        socket,
      });

      const response = parseSentMessage(socket);
      expect(response).toMatchObject({
        type: 'response',
        requestId: 'req-err2',
        data: null,
        error: {
          code: 'COMMAND_ERROR',
          message: 'Session not found',
        },
      });
    });

    it('does not send when socket is not open', async () => {
      const closedSocket = { readyState: 3, send: vi.fn() } as unknown as WebSocket;
      const mockResult = { data: [], total: 0, offset: 0, limit: 50 };
      (sessionStorage.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      await handleCommand(makeMsg('list_sessions', undefined, 'req-closed'), {
        sessionStorage,
        agentLoop,
        socket: closedSocket,
      });

      expect(closedSocket.send).not.toHaveBeenCalled();
    });
  });
});
