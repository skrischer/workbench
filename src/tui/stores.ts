// src/tui/stores.ts — TUI Zustand Store Instances

import { createChatStore } from '../shared/stores/chat-store.js';
import { createRunStore } from '../shared/stores/run-store.js';
import { createSessionStore } from '../shared/stores/session-store.js';

// Singleton store instances for the TUI process
export const chatStore = createChatStore();
export const runStore = createRunStore();
export const sessionStore = createSessionStore();
