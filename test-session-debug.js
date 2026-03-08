// Quick debug script to see what's happening
import { CoreAgentLoop } from './src/runtime/core-agent-loop.js';
import { SessionStorage } from './src/storage/session-storage.js';
import { createDefaultTools } from './src/tools/defaults.js';
// Mock Anthropic Client
class MockAnthropicClient {
    callCount = 0;
    async sendMessage() {
        this.callCount++;
        if (this.callCount === 1) {
            // First response: tool_use
            return {
                id: 'msg_001',
                type: 'message',
                role: 'assistant',
                content: [
                    { type: 'text', text: 'Let me read that file.' },
                    {
                        type: 'tool_use',
                        id: 'toolu_001',
                        name: 'read_file',
                        input: { path: 'nonexistent.txt' },
                    },
                ],
                model: 'claude-sonnet-4-20250514',
                stop_reason: 'tool_use',
                stop_sequence: null,
                usage: { input_tokens: 20, output_tokens: 30 },
            };
        }
        else {
            // Second response: end_turn
            return {
                id: 'msg_002',
                type: 'message',
                role: 'assistant',
                content: [{ type: 'text', text: 'File not found.' }],
                model: 'claude-sonnet-4-20250514',
                stop_reason: 'end_turn',
                stop_sequence: null,
                usage: { input_tokens: 15, output_tokens: 10 },
            };
        }
    }
}
async function main() {
    const mockClient = new MockAnthropicClient();
    const sessionStorage = new SessionStorage();
    const toolRegistry = createDefaultTools();
    const config = {
        model: 'claude-sonnet-4-20250514',
        maxSteps: 5,
        systemPrompt: 'Test',
        tools: ['read_file'],
    };
    const loop = new CoreAgentLoop(mockClient, sessionStorage, toolRegistry, config);
    const result = await loop.run('read nonexistent.txt');
    console.log('\n=== RUN RESULT ===');
    console.log(result);
    // Load session and print messages
    const session = await sessionStorage.load(result.sessionId);
    console.log('\n=== SESSION MESSAGES ===');
    console.log(JSON.stringify(session.messages, null, 2));
}
main().catch(console.error);
