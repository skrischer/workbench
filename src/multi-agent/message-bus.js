// src/multi-agent/message-bus.ts — Inter-Agent Message Passing
import { validateAgentMessage } from './validation.js';
import { eventBus } from '../events/event-bus.js';
/**
 * MessageBus — Enables agent-to-agent communication via send/broadcast/subscribe.
 *
 * Features:
 * - Send messages to specific agents
 * - Broadcast messages to all registered agents (except sender)
 * - Subscribe to messages with onMessage handlers
 * - Queue messages when no handler is registered (delivered on registration)
 * - Full message history tracking
 * - Event bus integration (message:sent, message:received)
 */
export class MessageBus {
    handlers = new Map();
    queues = new Map();
    history = [];
    /**
     * Send a message to a specific agent.
     * @param from - Sender agent ID
     * @param to - Recipient agent ID
     * @param type - Message type
     * @param payload - Message payload
     * @returns The created message
     */
    send(from, to, type, payload) {
        const message = {
            from,
            to,
            type,
            payload,
            timestamp: new Date().toISOString(),
        };
        // Validate message
        validateAgentMessage(message);
        // Store in history
        this.history.push(message);
        // Emit sent event
        eventBus.emit('message:sent', {
            from: message.from,
            to: message.to,
            type: message.type,
            payload: message.payload,
        });
        // Deliver message
        const handlers = this.handlers.get(to);
        if (handlers && handlers.size > 0) {
            // Deliver to all registered handlers
            for (const handler of handlers) {
                handler(message);
            }
            // Emit received event
            eventBus.emit('message:received', {
                agentId: to,
                from: message.from,
                to: message.to,
                type: message.type,
                payload: message.payload,
            });
        }
        else {
            // No handler registered - queue the message
            if (!this.queues.has(to)) {
                this.queues.set(to, []);
            }
            this.queues.get(to).push(message);
        }
        return message;
    }
    /**
     * Broadcast a message to all registered agents (except sender).
     * @param from - Sender agent ID
     * @param type - Message type
     * @param payload - Message payload
     * @returns Array of created messages (one per recipient)
     */
    broadcast(from, type, payload) {
        const messages = [];
        const recipients = Array.from(this.handlers.keys()).filter((id) => id !== from);
        for (const to of recipients) {
            const message = this.send(from, to, type, payload);
            messages.push(message);
        }
        return messages;
    }
    /**
     * Register a message handler for an agent.
     * Immediately delivers any queued messages.
     * @param agentId - Agent ID to receive messages for
     * @param callback - Handler function
     * @returns Unsubscribe function
     */
    onMessage(agentId, callback) {
        // Register handler
        if (!this.handlers.has(agentId)) {
            this.handlers.set(agentId, new Set());
        }
        this.handlers.get(agentId).add(callback);
        // Deliver queued messages
        const queue = this.queues.get(agentId);
        if (queue && queue.length > 0) {
            for (const message of queue) {
                callback(message);
                // Emit received event
                eventBus.emit('message:received', {
                    agentId,
                    from: message.from,
                    to: message.to,
                    type: message.type,
                    payload: message.payload,
                });
            }
            // Clear queue
            this.queues.delete(agentId);
        }
        // Return unsubscribe function
        return () => {
            const handlers = this.handlers.get(agentId);
            if (handlers) {
                handlers.delete(callback);
                if (handlers.size === 0) {
                    this.handlers.delete(agentId);
                }
            }
        };
    }
    /**
     * Get queued (undelivered) messages for an agent.
     * @param agentId - Agent ID
     * @returns Array of queued messages
     */
    getQueue(agentId) {
        return this.queues.get(agentId) || [];
    }
    /**
     * Get message history, optionally filtered by agent.
     * @param agentId - Optional agent ID to filter by (matches from or to)
     * @returns Array of messages
     */
    getHistory(agentId) {
        if (agentId === undefined) {
            return [...this.history];
        }
        return this.history.filter((msg) => msg.from === agentId || msg.to === agentId);
    }
}
