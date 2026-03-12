// src/shared/stores/chat-store.ts — Chat State Management
import { createStore } from 'zustand/vanilla';
import type { ChatMessage, ToolCallState } from '../types/ui.js';

export interface ChatState {
  messages: Map<string, ChatMessage[]>;
  streamingText: string;
  streamingToolCalls: Map<string, ToolCallState>;
}

export interface ChatActions {
  addMessage: (sessionId: string, message: ChatMessage) => void;
  setMessages: (sessionId: string, messages: ChatMessage[]) => void;
  appendStreamDelta: (text: string) => void;
  resetStreaming: () => void;
  setToolCallStart: (toolId: string, toolName: string) => void;
  appendToolInput: (toolId: string, inputDelta: string) => void;
  setToolResult: (toolId: string, result: string, durationMs: number, isError: boolean) => void;
  clear: (sessionId: string) => void;
}

export type ChatStore = ChatState & ChatActions;

export const createChatStore = () =>
  createStore<ChatStore>((set) => ({
    messages: new Map(),
    streamingText: '',
    streamingToolCalls: new Map(),

    addMessage: (sessionId, message) =>
      set((state) => {
        const updated = new Map(state.messages);
        const existing = updated.get(sessionId) ?? [];
        updated.set(sessionId, [...existing, message]);
        return { messages: updated };
      }),

    setMessages: (sessionId, messages) =>
      set((state) => {
        const updated = new Map(state.messages);
        updated.set(sessionId, messages);
        return { messages: updated };
      }),

    appendStreamDelta: (text) =>
      set((state) => ({ streamingText: state.streamingText + text })),

    resetStreaming: () =>
      set({ streamingText: '', streamingToolCalls: new Map() }),

    setToolCallStart: (toolId, toolName) =>
      set((state) => {
        const updated = new Map(state.streamingToolCalls);
        updated.set(toolId, {
          toolId,
          toolName,
          input: '',
          status: 'running',
        });
        return { streamingToolCalls: updated };
      }),

    appendToolInput: (toolId, inputDelta) =>
      set((state) => {
        const updated = new Map(state.streamingToolCalls);
        const existing = updated.get(toolId);
        if (existing) {
          updated.set(toolId, {
            ...existing,
            input: existing.input + inputDelta,
          });
        }
        return { streamingToolCalls: updated };
      }),

    setToolResult: (toolId, result, durationMs, isError) =>
      set((state) => {
        const updated = new Map(state.streamingToolCalls);
        const existing = updated.get(toolId);
        if (existing) {
          updated.set(toolId, {
            ...existing,
            result,
            durationMs,
            status: isError ? 'error' : 'success',
          });
        }
        return { streamingToolCalls: updated };
      }),

    clear: (sessionId) =>
      set((state) => {
        const updated = new Map(state.messages);
        updated.delete(sessionId);
        return { messages: updated };
      }),
  }));
