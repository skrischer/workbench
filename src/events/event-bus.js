// src/events/event-bus.ts — Typed Event Bus Implementation
/**
 * TypedEventBus — Type-safe pub/sub system for internal events.
 *
 * All events are synchronous. Listeners are called immediately during emit().
 * EventMap defines all available events and their payload types.
 */
export class TypedEventBus {
    listeners = new Map();
    /**
     * Register an event listener.
     * @param event - Event name
     * @param listener - Callback function
     * @returns Unsubscribe function
     */
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        const handlers = this.listeners.get(event);
        handlers.add(listener);
        // Return unsubscribe function
        return () => {
            handlers.delete(listener);
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
    off(event, listener) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.delete(listener);
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
    once(event, listener) {
        const wrapper = (payload) => {
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
    emit(event, payload) {
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
    clear(event) {
        if (event !== undefined) {
            this.listeners.delete(event);
        }
        else {
            this.listeners.clear();
        }
    }
    /**
     * Get the number of listeners for a specific event.
     * @param event - Event name
     * @returns Number of registered listeners
     */
    listenerCount(event) {
        const handlers = this.listeners.get(event);
        return handlers ? handlers.size : 0;
    }
}
// Export singleton instance
export const eventBus = new TypedEventBus();
