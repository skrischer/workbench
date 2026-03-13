// src/tui/context.tsx — React Contexts for TUI

import { createContext, useContext } from 'react';

/** Runtime state shared across components */
export interface RuntimeState {
  runId: string | null;
  isRunning: boolean;
  abort: () => void;
}

export const RuntimeContext = createContext<RuntimeState>({
  runId: null,
  isRunning: false,
  abort: () => {},
});

/** Hook to get RuntimeState from context */
export function useRuntimeContext(): RuntimeState {
  return useContext(RuntimeContext);
}
