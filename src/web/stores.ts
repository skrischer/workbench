// src/web/stores.ts — Module-level store singletons for the Web UI
import { useStore } from 'zustand';
import { createUIStore, type UIStore } from '../shared/stores/ui-store.js';
import { createChatStore, type ChatStore } from '../shared/stores/chat-store.js';
import { createRunStore, type RunStore } from '../shared/stores/run-store.js';
import { createSessionStore, type SessionStore } from '../shared/stores/session-store.js';

export const uiStore = createUIStore();
export const chatStore = createChatStore();
export const runStore = createRunStore();
export const sessionStore = createSessionStore();

export function useUIStore<T>(selector: (state: UIStore) => T): T {
  return useStore(uiStore, selector);
}

export function useChatStore<T>(selector: (state: ChatStore) => T): T {
  return useStore(chatStore, selector);
}

export function useRunStore<T>(selector: (state: RunStore) => T): T {
  return useStore(runStore, selector);
}

export function useSessionStore<T>(selector: (state: SessionStore) => T): T {
  return useStore(sessionStore, selector);
}
