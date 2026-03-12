// src/tui/hooks/use-event-bus.ts — EventBus subscription hook with auto-cleanup

import { useEffect } from 'react';
import type { EventMap, EventListener } from '../../types/events.js';
import { useEventBusContext } from '../context.js';

/**
 * Subscribe to an EventBus event with automatic cleanup on unmount.
 *
 * @param event - Event name from EventMap
 * @param handler - Callback receiving the event payload
 */
export function useEventBus<K extends keyof EventMap>(
  event: K,
  handler: EventListener<EventMap[K]>
): void {
  const eventBus = useEventBusContext();

  useEffect(() => {
    const unsubscribe = eventBus.on(event, handler);
    return unsubscribe;
  }, [eventBus, event, handler]);
}
