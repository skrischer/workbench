import Fastify, { type FastifyInstance } from 'fastify';

export interface MockResponse {
  match?: (body: Record<string, unknown>) => boolean;
  response: Record<string, unknown>;
  status?: number;
}

export interface MockAnthropicServer {
  url: string;
  port: number;
  calls: Record<string, unknown>[];
  close: () => Promise<void>;
}

export async function createMockAnthropicServer(
  responses: MockResponse[]
): Promise<MockAnthropicServer> {
  const app: FastifyInstance = Fastify();
  let callIndex = 0;
  const calls: Record<string, unknown>[] = [];

  app.post('/v1/messages', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    calls.push(body);

    // Find matching response or use FIFO
    const mock = responses.find(r => r.match?.(body)) ?? responses[callIndex++];

    if (!mock) {
      return reply.status(500).send({
        type: 'error',
        error: { type: 'internal_error', message: 'No mock response configured' },
      });
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
