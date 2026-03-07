// src/events/event-bus.ts — Typed Event Bus Implementation

import type { EventMap, EventListener, Unsubscribe } from '../types/events.js';

/**
 * TypedEventBus — Type-safe pub/sub system for internal events.
 * 
 * All events are synchronous. Listeners are called immediately during emit().
 * EventMap defines all available events and their payload types.
 */
export class TypedEventBus<TEventMap = EventMap> {
  private listeners: Map<keyof TEventMap, Set<EventListener<unknown>>> = new Map();

  /**
   * Register an event listener.
   * @param event - Event name
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  on<K extends keyof TEventMap>(
    event: K,
    listener: EventListener<TEventMap[K]>
  ): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const handlers = this.listeners.get(event)!;
    handlers.add(listener as EventListener<unknown>);

    // Return unsubscribe function
    return () => {
      handlers.delete(listener as EventListener<unknown>);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Remove a specific event listener.
   * @param event - Event name
   * @param listener - Callback function to remove
   */
  off<K extends keyof TEventMap>(
    event: K,
    listener: EventListener<TEventMap[K]>
  ): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(listener as EventListener<unknown>);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Register a one-time event listener.
   * Automatically unsubscribes after first invocation.
   * @param event - Event name
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  once<K extends keyof TEventMap>(
    event: K,
    listener: EventListener<TEventMap[K]>
  ): Unsubscribe {
    const wrapper: EventListener<TEventMap[K]> = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };

    return this.on(event, wrapper);
  }

  /**
   * Emit an event to all registered listeners (synchronous).
   * @param event - Event name
   * @param payload - Event payload
   */
  emit<K extends keyof TEventMap>(event: K, payload: TEventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      // Call all listeners synchronously
      for (const handler of handlers) {
        handler(payload);
      }
    }
  }

  /**
   * Clear all listeners for a specific event, or all events if no event specified.
   * @param event - Optional event name to clear
   */
  clear<K extends keyof TEventMap>(event?: K): void {
    if (event !== undefined) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for a specific event.
   * @param event - Event name
   * @returns Number of registered listeners
   */
  listenerCount<K extends keyof TEventMap>(event: K): number {
    const handlers = this.listeners.get(event);
    return handlers ? handlers.size : 0;
  }
}

// Export singleton instance
export const eventBus = new TypedEventBus();
