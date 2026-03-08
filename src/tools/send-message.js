// src/tools/send-message.ts — Send Message Tool
import { BaseTool } from './base.js';
/**
 * Tool for sending messages between agents via the message bus.
 */
export class SendMessageTool extends BaseTool {
    name = 'send_message';
    description = 'Send a message to another agent via the message bus. Message is queued if recipient has no handler registered.';
    inputSchema = {
        type: 'object',
        properties: {
            from: {
                type: 'string',
                description: 'Sender agent ID',
            },
            to: {
                type: 'string',
                description: 'Recipient agent ID',
            },
            type: {
                type: 'string',
                enum: ['task', 'result', 'status', 'error'],
                description: 'Message type',
            },
            payload: {
                description: 'Message payload (any JSON-serializable value)',
            },
        },
        required: ['from', 'to', 'type', 'payload'],
    };
    bus;
    /**
     * Creates a SendMessageTool instance.
     * @param bus - MessageBus instance for sending messages
     */
    constructor(bus) {
        super();
        this.bus = bus;
    }
    async execute(input) {
        try {
            const from = input.from;
            const to = input.to;
            const type = input.type;
            const payload = input.payload;
            // Send message via bus
            const message = this.bus.send(from, to, type, payload);
            return {
                success: true,
                output: `Message sent from ${from} to ${to} (type: ${type})`,
                metadata: {
                    from: message.from,
                    to: message.to,
                    type: message.type,
                    timestamp: message.timestamp,
                    payload: message.payload,
                },
            };
        }
        catch (err) {
            const error = err;
            return {
                success: false,
                output: '',
                error: `Failed to send message: ${error.message}`,
            };
        }
    }
}
