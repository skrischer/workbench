// src/server/command-handler.ts — WebSocket Command Handler
import type { WebSocket } from 'ws';
import type {
  WsCommandMessage,
  WsResponseMessage,
  LoadSessionPayload,
  SendMessagePayload,
  AbortRunPayload,
  SearchSessionsPayload,
} from '../types/ws-protocol.js';
import type { SessionStorage } from '../storage/session-storage.js';
import type { AgentLoop } from '../runtime/agent-loop.js';

interface CommandContext {
  sessionStorage: SessionStorage;
  agentLoop: AgentLoop;
  socket: WebSocket;
}

function sendResponse(
  socket: WebSocket,
  requestId: string,
  data: unknown,
  error?: { code: string; message: string },
): void {
  const msg: WsResponseMessage = { type: 'response', requestId, data, error };
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(msg));
  }
}

export async function handleCommand(
  msg: WsCommandMessage,
  ctx: CommandContext,
): Promise<void> {
  const { command, requestId, payload } = msg;

  // Commands without requestId are fire-and-forget
  if (!requestId) {
    await executeCommand(command, payload, ctx);
    return;
  }

  try {
    const result = await executeCommand(command, payload, ctx);
    sendResponse(ctx.socket, requestId, result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sendResponse(ctx.socket, requestId, null, {
      code: 'COMMAND_ERROR',
      message,
    });
  }
}

async function executeCommand(
  command: string,
  payload: unknown,
  ctx: CommandContext,
): Promise<unknown> {
  switch (command) {
    case 'list_sessions': {
      return ctx.sessionStorage.list({ limit: 50, sort: 'desc' });
    }

    case 'load_session': {
      const { id } = payload as LoadSessionPayload;
      return ctx.sessionStorage.load(id);
    }

    case 'create_session': {
      return ctx.sessionStorage.createSession();
    }

    case 'send_message': {
      const { sessionId, prompt } = payload as SendMessagePayload;
      // Fire-and-forget: runStreaming emits events that the bridge forwards
      void ctx.agentLoop.runStreaming(prompt, sessionId);
      return { status: 'started' };
    }

    case 'abort_run': {
      const { runId } = payload as AbortRunPayload;
      const aborted = ctx.agentLoop.cancel(runId);
      return { aborted };
    }

    case 'search_sessions': {
      const { query, limit } = payload as SearchSessionsPayload;
      const result = await ctx.sessionStorage.list({
        limit: limit ?? 20,
        sort: 'desc',
      });
      // Simple client-side filter for now — later replace with full-text search
      if (query) {
        return {
          ...result,
          data: result.data.filter(
            (s) => s.id.includes(query) || s.agentId.includes(query),
          ),
        };
      }
      return result;
    }

    default:
      throw new Error(`Unknown command: ${command}`);
  }
}
