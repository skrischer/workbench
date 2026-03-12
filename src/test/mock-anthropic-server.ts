import Fastify, { type FastifyInstance } from 'fastify';

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/**
 * Convert a standard Anthropic Messages API response fixture
 * into SSE event lines for streaming mode.
 */
function convertToSSE(fixture: Record<string, unknown>): string {
  const lines: string[] = [];
  const content = (fixture.content ?? []) as ContentBlock[];
  const usage = (fixture.usage ?? { input_tokens: 0, output_tokens: 0 }) as {
    input_tokens: number;
    output_tokens: number;
  };
  const model = (fixture.model ?? 'claude-sonnet-4-20250514') as string;
  const stopReason = (fixture.stop_reason ?? 'end_turn') as string;

  // message_start
  lines.push(`data: ${JSON.stringify({
    type: 'message_start',
    message: {
      id: fixture.id ?? 'msg_mock',
      type: 'message',
      role: 'assistant',
      content: [],
      model,
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: usage.input_tokens, output_tokens: 0 },
    },
  })}\n`);

  // content blocks
  for (let i = 0; i < content.length; i++) {
    const block = content[i]!;

    if (block.type === 'text') {
      // content_block_start
      lines.push(`data: ${JSON.stringify({
        type: 'content_block_start',
        index: i,
        content_block: { type: 'text', text: '' },
      })}\n`);

      // content_block_delta (send full text at once)
      lines.push(`data: ${JSON.stringify({
        type: 'content_block_delta',
        index: i,
        delta: { type: 'text_delta', text: block.text ?? '' },
      })}\n`);

      // content_block_stop
      lines.push(`data: ${JSON.stringify({
        type: 'content_block_stop',
        index: i,
      })}\n`);
    } else if (block.type === 'tool_use') {
      // content_block_start for tool_use
      lines.push(`data: ${JSON.stringify({
        type: 'content_block_start',
        index: i,
        content_block: { type: 'tool_use', id: block.id, name: block.name },
      })}\n`);

      // input_json_delta (send full input as one chunk)
      const inputJson = JSON.stringify(block.input ?? {});
      lines.push(`data: ${JSON.stringify({
        type: 'content_block_delta',
        index: i,
        delta: { type: 'input_json_delta', partial_json: inputJson },
      })}\n`);

      // content_block_stop
      lines.push(`data: ${JSON.stringify({
        type: 'content_block_stop',
        index: i,
      })}\n`);
    }
  }

  // message_delta
  lines.push(`data: ${JSON.stringify({
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: usage.output_tokens },
  })}\n`);

  // message_stop
  lines.push(`data: ${JSON.stringify({ type: 'message_stop' })}\n`);

  return lines.join('\n');
}

export interface MockResponse {
  match?: (body: Record<string, unknown>) => boolean;
  response: Record<string, unknown>;
  status?: number;
}

export interface MockCall {
  body: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
}

export interface MockAnthropicServer {
  url: string;
  port: number;
  calls: MockCall[];
  close: () => Promise<void>;
}

export async function createMockAnthropicServer(
  responses: MockResponse[]
): Promise<MockAnthropicServer> {
  const app: FastifyInstance = Fastify();
  let callIndex = 0;
  const calls: MockCall[] = [];

  app.post('/v1/messages', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    calls.push({
      body,
      headers: req.headers,
    });

    // Find matching response or use FIFO
    const mock = responses.find(r => r.match?.(body)) ?? responses[callIndex++];

    if (!mock) {
      return reply.status(500).send({
        type: 'error',
        error: { type: 'internal_error', message: 'No mock response configured' },
      });
    }

    // If client requests streaming, convert fixture to SSE events
    if (body.stream === true && (mock.status ?? 200) === 200) {
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const ssePayload = convertToSSE(mock.response);
      reply.raw.write(ssePayload);
      reply.raw.end();
      return;
    }

    return reply.status(mock.status ?? 200).send(mock.response);
  });

  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const port = (app.server.address() as { port: number }).port;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    calls,
    close: () => app.close(),
  };
}
