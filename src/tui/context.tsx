// src/tui/context.tsx — React Contexts for TUI

import React, { createContext, useContext } from 'react';
import type { TypedEventBus } from '../events/event-bus.js';
import type { SessionStorage } from '../storage/session-storage.js';


/** EventBus context */
export const EventBusContext = createContext<TypedEventBus | null>(null);

/** SessionStorage context */
export const StorageContext = createContext<SessionStorage | null>(null);

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

/** Hook to get the EventBus from context */
export function useEventBusContext(): TypedEventBus {
  const bus = useContext(EventBusContext);
  if (!bus) throw new Error('EventBusContext not provided');
  return bus;
}

/** Hook to get SessionStorage from context */
export function useStorageContext(): SessionStorage {
  const storage = useContext(StorageContext);
  if (!storage) throw new Error('StorageContext not provided');
  return storage;
}

/** Hook to get RuntimeState from context */
export function useRuntimeContext(): RuntimeState {
  return useContext(RuntimeContext);
}
