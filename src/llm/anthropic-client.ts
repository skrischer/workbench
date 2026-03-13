import type { LLMMessage, LLMToolDef, LLMConfig, LLMResponse, RateLimitInfo } from '../types/index.js';
import type { StreamDelta, StreamingResponse } from './streaming.js';
import { TokenRefresher } from './token-refresh.js';
import { DEFAULT_MODEL, ANTHROPIC_API_URL, resolveModelName } from '../config/index.js';
import { fallbackHandler } from './fallback-handler.js';

/**
 * Parse Anthropic unified rate limit headers into RateLimitInfo
 */
function parseRateLimitHeaders(headers: Headers | undefined): RateLimitInfo | undefined {
  if (!headers || typeof headers.get !== 'function') return undefined;
  const fiveHourUtil = headers.get('anthropic-ratelimit-unified-5h-utilization');
  if (fiveHourUtil === null) return undefined;

  return {
    fiveHourUtilization: parseFloat(fiveHourUtil) || 0,
    fiveHourReset: parseResetUnix(headers.get('anthropic-ratelimit-unified-5h-reset')),
    fiveHourStatus: headers.get('anthropic-ratelimit-unified-5h-status') ?? 'allowed',
    sevenDayUtilization: parseFloat(headers.get('anthropic-ratelimit-unified-7d-utilization') ?? '0') || 0,
    sevenDayReset: parseResetUnix(headers.get('anthropic-ratelimit-unified-7d-reset')),
    sevenDayStatus: headers.get('anthropic-ratelimit-unified-7d-status') ?? 'allowed',
  };
}

/** Parse reset value (Unix seconds or ISO 8601) to Unix seconds, or return 0 */
function parseResetUnix(value: string | null): number {
  if (!value) return 0;
  // Try as plain number (Unix seconds) first
  const num = Number(value);
  if (!Number.isNaN(num) && num > 0) return Math.floor(num);
  // Fallback: ISO 8601 timestamp
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000);
}

/**
 * AnthropicClient — Messages API client with OAuth Bearer token authentication
 * 
 * Handles API calls to Anthropic's Messages API with automatic token refresh
 * and model fallback on retriable errors.
 */
export class AnthropicClient {
  private tokenRefresher: TokenRefresher;
  private config: Required<LLMConfig>;

  constructor(tokenRefresher: TokenRefresher, config?: Partial<LLMConfig>) {
    this.tokenRefresher = tokenRefresher;
    this.config = {
      model: config?.model ?? DEFAULT_MODEL,
      maxTokens: config?.maxTokens ?? 8192,
      apiUrl: config?.apiUrl ?? ANTHROPIC_API_URL
    };
  }

  /**
   * Send a message to the Anthropic Messages API
   * 
   * @param messages - Conversation history
   * @param tools - Optional tool definitions
   * @param options - Optional system prompt
   * @returns API response with content blocks and usage stats
   * @throws Error on authentication, rate limit, or server errors (after exhausting fallbacks)
   */
  async sendMessage(
    messages: LLMMessage[],
    tools?: LLMToolDef[],
    options?: { system?: string }
  ): Promise<LLMResponse> {
    let currentModel = this.config.model;
    const attemptedModels: string[] = [];
    
    while (true) {
      attemptedModels.push(currentModel);
      
      try {
        return await this.sendMessageWithModel(messages, currentModel, tools, options);
      } catch (error) {
        // Handle error and check if we should fallback
        const { shouldFallback, nextModel } = fallbackHandler.handleError(error, currentModel);
        
        if (!shouldFallback || !nextModel) {
          // No fallback available or error is not retriable
          if (attemptedModels.length > 1) {
            // Enhance error with fallback context
            const errorMsg = error instanceof Error ? error.message : String(error);
            throw new Error(
              `All model fallbacks exhausted. Attempted models: ${attemptedModels.join(', ')}. Final error: ${errorMsg}`
            );
          }
          // Re-throw original error
          throw error;
        }
        
        // Try next model
        currentModel = nextModel;
      }
    }
  }

  /**
   * Send a message with a specific model (internal helper)
   * 
   * @param messages - Conversation history
   * @param model - Model identifier to use
   * @param tools - Optional tool definitions
   * @param options - Optional system prompt
   * @returns API response
   * @throws Error on any API failure
   */
  private async sendMessageWithModel(
    messages: LLMMessage[],
    model: string,
    tools?: LLMToolDef[],
    options?: { system?: string }
  ): Promise<LLMResponse> {
    // Get valid access token
    const accessToken = await this.tokenRefresher.ensureValidToken();

    // Resolve model name alias to full identifier
    const resolvedModel = resolveModelName(model);

    // Build request body
    const requestBody: Record<string, unknown> = {
      model: resolvedModel,
      max_tokens: this.config.maxTokens,
      messages
    };

    // Add optional fields only if provided and non-empty
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }
    if (options?.system) {
      requestBody.system = options.system;
    }

    // Make API request
    let response: Response;
    try {
      response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          'anthropic-beta': 'oauth-2025-04-20,claude-code-20250219'
        },
        body: JSON.stringify(requestBody)
      });
    } catch (error) {
      throw new Error(`Network error during API call: ${error}`);
    }

    // Handle specific error cases
    if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }

    if (response.status === 401) {
      throw new Error('Authentication failed');
    }

    if (response.status === 404) {
      throw new Error(`Model not found: ${resolvedModel} (status 404)`);
    }

    if (response.status === 503) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Service unavailable: ${response.status} - ${errorText}`);
    }

    if (response.status >= 500 && response.status < 600) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Anthropic API server error: ${response.status} - ${errorText}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API request failed with status ${response.status}: ${errorText}`);
    }

    // Parse and return response
    try {
      const data = await response.json() as LLMResponse;
      // Attach rate limit info from headers
      const rateLimit = parseRateLimitHeaders(response.headers);
      if (rateLimit) {
        data.rateLimit = rateLimit;
      }
      return data;
    } catch (error) {
      throw new Error(`Failed to parse API response: ${error}`);
    }
  }

  /**
   * Send a streaming message to the Anthropic Messages API.
   * Returns an async iterable of StreamDelta events.
   *
   * @param messages - Conversation history
   * @param tools - Optional tool definitions
   * @param options - Optional system prompt and abort signal
   * @returns StreamingResponse — async iterable + abort()
   */
  async sendMessageStream(
    messages: LLMMessage[],
    tools?: LLMToolDef[],
    options?: { system?: string; signal?: AbortSignal }
  ): Promise<StreamingResponse> {
    const accessToken = await this.tokenRefresher.ensureValidToken();
    const resolvedModel = resolveModelName(this.config.model);

    const requestBody: Record<string, unknown> = {
      model: resolvedModel,
      max_tokens: this.config.maxTokens,
      messages,
      stream: true,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }
    if (options?.system) {
      requestBody.system = options.system;
    }

    const abortController = new AbortController();

    // Forward external signal
    if (options?.signal) {
      if (options.signal.aborted) {
        abortController.abort();
      } else {
        options.signal.addEventListener('abort', () => abortController.abort(), { once: true });
      }
    }

    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20,claude-code-20250219',
      },
      body: JSON.stringify(requestBody),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Streaming API request failed (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null — streaming not supported');
    }

    // Parse rate limit headers from initial response
    const rateLimit = parseRateLimitHeaders(response.headers);

    const body = response.body;

    async function* parseSSE(): AsyncGenerator<StreamDelta> {
      const decoder = new TextDecoder();
      const reader = body.getReader();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') return;

            try {
              const event = JSON.parse(jsonStr) as Record<string, unknown>;
              const eventType = event.type as string;

              if (eventType === 'message_start') {
                const message = event.message as Record<string, unknown>;
                const usage = message.usage as Record<string, unknown>;
                yield {
                  type: 'message_start',
                  inputTokens: (usage?.input_tokens as number) ?? 0,
                  model: (message.model as string) ?? '',
                };
              } else if (eventType === 'content_block_delta') {
                const delta = event.delta as Record<string, unknown>;
                if (delta.type === 'text_delta') {
                  yield { type: 'text_delta', text: delta.text as string };
                } else if (delta.type === 'input_json_delta') {
                  yield { type: 'tool_input_delta', inputDelta: delta.partial_json as string };
                }
              } else if (eventType === 'content_block_start') {
                const block = event.content_block as Record<string, unknown>;
                if (block.type === 'tool_use') {
                  yield {
                    type: 'tool_use_start',
                    toolName: block.name as string,
                    toolId: block.id as string,
                  };
                }
              } else if (eventType === 'content_block_stop') {
                yield { type: 'content_block_stop' };
              } else if (eventType === 'message_delta') {
                const delta = event.delta as Record<string, unknown>;
                const usage = event.usage as Record<string, unknown>;
                yield {
                  type: 'message_delta',
                  outputTokens: (usage?.output_tokens as number) ?? 0,
                  stopReason: (delta?.stop_reason as string) ?? '',
                };
              } else if (eventType === 'message_stop') {
                yield { type: 'message_stop' };
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    const iterator = parseSSE();

    return {
      [Symbol.asyncIterator]() {
        return iterator;
      },
      abort() {
        abortController.abort();
      },
      rateLimit: rateLimit ?? undefined,
    };
  }
}
