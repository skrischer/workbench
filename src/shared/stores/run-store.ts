// src/shared/stores/run-store.ts — Run State Management
import { createStore } from 'zustand/vanilla';

export interface RunState {
  activeRunId: string | null;
  isRunning: boolean;
  tokenUsage: { input: number; output: number };
  stepCount: number;
  model: string;
}

export interface RunActions {
  setRunning: (runId: string, model?: string) => void;
  setEnded: () => void;
  updateTokens: (input: number, output: number) => void;
  incrementStep: () => void;
  reset: () => void;
}

export type RunStore = RunState & RunActions;

export const createRunStore = () =>
  createStore<RunStore>((set) => ({
    activeRunId: null,
    isRunning: false,
    tokenUsage: { input: 0, output: 0 },
    stepCount: 0,
    model: '',

    setRunning: (runId, model) =>
      set({
        activeRunId: runId,
        isRunning: true,
        tokenUsage: { input: 0, output: 0 },
        stepCount: 0,
        model: model ?? '',
      }),

    setEnded: () =>
      set({ isRunning: false, activeRunId: null }),

    updateTokens: (input, output) =>
      set((state) => ({
        tokenUsage: {
          input: state.tokenUsage.input + input,
          output: state.tokenUsage.output + output,
        },
      })),

    incrementStep: () =>
      set((state) => ({ stepCount: state.stepCount + 1 })),

    reset: () =>
      set({
        activeRunId: null,
        isRunning: false,
        tokenUsage: { input: 0, output: 0 },
        stepCount: 0,
        model: '',
      }),
  }));
