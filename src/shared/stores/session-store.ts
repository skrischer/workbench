// src/shared/stores/session-store.ts — Session State Management
import { createStore } from 'zustand/vanilla';
import type { SessionPreview } from '../types/ui.js';

export interface SessionState {
  sessions: SessionPreview[];
  activeId: string | null;
  filter: string;
  isLoading: boolean;
}

export interface SessionActions {
  setActive: (id: string | null) => void;
  addSession: (session: SessionPreview) => void;
  updateSession: (id: string, updates: Partial<SessionPreview>) => void;
  setSessions: (sessions: SessionPreview[]) => void;
  setFilter: (filter: string) => void;
  setLoading: (loading: boolean) => void;
}

export type SessionStore = SessionState & SessionActions;

export const createSessionStore = () =>
  createStore<SessionStore>((set) => ({
    sessions: [],
    activeId: null,
    filter: '',
    isLoading: false,

    setActive: (id) => set({ activeId: id }),
    addSession: (session) =>
      set((state) => ({ sessions: [session, ...state.sessions] })),
    updateSession: (id, updates) =>
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
      })),
    setSessions: (sessions) => set({ sessions }),
    setFilter: (filter) => set({ filter }),
    setLoading: (isLoading) => set({ isLoading }),
  }));
