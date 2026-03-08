/**
 * AnthropicClient — Messages API client with OAuth Bearer token authentication
 *
 * Handles API calls to Anthropic's Messages API with automatic token refresh.
 */
export class AnthropicClient {
    tokenRefresher;
    config;
    constructor(tokenRefresher, config) {
        this.tokenRefresher = tokenRefresher;
        this.config = {
            model: config?.model ?? 'claude-sonnet-4-20250514',
            maxTokens: config?.maxTokens ?? 8192,
            apiUrl: config?.apiUrl ?? 'https://api.anthropic.com/v1/messages'
        };
    }
    /**
     * Send a message to the Anthropic Messages API
     *
     * @param messages - Conversation history
     * @param tools - Optional tool definitions
     * @param options - Optional system prompt
     * @returns API response with content blocks and usage stats
     * @throws Error on authentication, rate limit, or server errors
     */
    async sendMessage(messages, tools, options) {
        // Get valid access token
        const accessToken = await this.tokenRefresher.ensureValidToken();
        // Build request body
        const requestBody = {
            model: this.config.model,
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
        let response;
        try {
            response = await fetch(this.config.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
        }
        catch (error) {
            throw new Error(`Network error during API call: ${error}`);
        }
        // Handle specific error cases
        if (response.status === 429) {
            throw new Error('Rate limit exceeded');
        }
        if (response.status === 401) {
            throw new Error('Authentication failed');
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
            const data = await response.json();
            return data;
        }
        catch (error) {
            throw new Error(`Failed to parse API response: ${error}`);
        }
    }
}
