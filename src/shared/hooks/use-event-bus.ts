// src/shared/hooks/use-event-bus.ts — Renderer-agnostic EventBus subscription hook

import { useEffect } from 'react';
import type { EventMap, EventListener } from '../../types/events.js';
import type { TypedEventBus } from '../../events/event-bus.js';

/**
 * Subscribe to an EventBus event with automatic cleanup on unmount.
 * Renderer-agnostic — works with both Ink and React DOM.
 *
 * @param eventBus - The EventBus instance
 * @param event - Event name from EventMap
 * @param handler - Callback receiving the event payload
 */
export function useEventBus<K extends keyof EventMap>(
  eventBus: TypedEventBus,
  event: K,
  handler: EventListener<EventMap[K]>
): void {
  useEffect(() => {
    const unsubscribe = eventBus.on(event, handler);
    return unsubscribe;
  }, [eventBus, event, handler]);
}
