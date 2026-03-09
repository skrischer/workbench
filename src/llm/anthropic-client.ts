import type { LLMMessage, LLMToolDef, LLMConfig, LLMResponse } from '../types/index.js';
import { TokenRefresher } from './token-refresh.js';
import { DEFAULT_MODEL, ANTHROPIC_API_URL, resolveModelName } from '../config/index.js';
import { fallbackHandler } from './fallback-handler.js';

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
      return data;
    } catch (error) {
      throw new Error(`Failed to parse API response: ${error}`);
    }
  }
}
