// src/shared/ws-client/use-ws-dispatcher.ts — Routes WS events to Zustand stores

import { useEffect, useRef } from 'react';
import type { ServerMessage, WsEventMessage } from '../../types/ws-protocol.js';
import type { EventMap } from '../../types/events.js';
import type { ChatStore } from '../stores/chat-store.js';
import type { RunStore } from '../stores/run-store.js';
import type { ChatMessage } from '../types/ui.js';

interface DispatcherStores {
  chatStore: ChatStore;
  runStore: RunStore;
}

/**
 * Dispatches incoming WS event messages to the appropriate Zustand stores.
 * Accepts store instances as parameter to avoid circular dependency on store creation.
 */
export function useWsDispatcher(
  lastMessage: ServerMessage | null,
  stores: DispatcherStores,
): void {
  const storesRef = useRef(stores);
  storesRef.current = stores;

  useEffect(() => {
    if (!lastMessage || lastMessage.type !== 'event') return;

    const eventMsg = lastMessage as WsEventMessage;
    const { chatStore, runStore } = storesRef.current;

    switch (eventMsg.event) {
      case 'session:message': {
        const data = eventMsg.data as EventMap['session:message'];
        const chatMsg: ChatMessage = {
          role: data.message.role === 'system' ? 'assistant' : data.message.role,
          content: data.message.content,
          toolCallId: data.message.toolCallId,
          timestamp: data.message.timestamp,
        };
        chatStore.addMessage(data.sessionId, chatMsg);
        break;
      }

      case 'run:start': {
        const data = eventMsg.data as EventMap['run:start'];
        runStore.setRunning(data.runId, data.agentConfig.model);
        break;
      }

      case 'run:end': {
        runStore.setEnded();
        break;
      }

      case 'run:step': {
        runStore.incrementStep();
        break;
      }

      case 'llm:stream:delta': {
        const data = eventMsg.data as EventMap['llm:stream:delta'];
        chatStore.appendStreamDelta(data.text);
        break;
      }

      case 'llm:stream:tool_start': {
        const data = eventMsg.data as EventMap['llm:stream:tool_start'];
        chatStore.setToolCallStart(data.toolId, data.toolName);
        break;
      }

      case 'llm:stream:tool_input': {
        const data = eventMsg.data as EventMap['llm:stream:tool_input'];
        chatStore.appendToolInput(data.toolId, data.inputDelta);
        break;
      }

      case 'llm:response': {
        const data = eventMsg.data as EventMap['llm:response'];
        runStore.updateTokens(data.tokenUsage.inputTokens, data.tokenUsage.outputTokens);
        break;
      }

      case 'tool:call': {
        const data = eventMsg.data as EventMap['tool:call'];
        const toolId = `${data.runId}-${data.stepIndex}-${data.toolName}`;
        chatStore.setToolCallStart(toolId, data.toolName);
        break;
      }

      case 'tool:result': {
        const data = eventMsg.data as EventMap['tool:result'];
        // tool:result does not carry stepIndex, so we find by toolName in running calls
        // For now, use a synthetic ID matching pattern; a future refinement can correlate
        const output = data.result.success ? data.result.output : (data.result.error ?? 'Error');
        const isError = !data.result.success;
        // We don't have the exact toolId here. The WS server should ideally include it.
        // For now, dispatch with the toolName as a fallback — downstream store ignores unknown IDs.
        chatStore.setToolResult(data.toolName, output, data.durationMs, isError);
        break;
      }

      default:
        // Unhandled events are silently ignored
        break;
    }
  }, [lastMessage]);
}
