import { FileLock } from './file-lock.js';
import { ANTHROPIC_CLIENT_ID, ANTHROPIC_TOKEN_URL, TOKEN_REFRESH_BUFFER_MS } from './constants.js';
/**
 * TokenRefresher — Automatic OAuth token refresh management
 *
 * Ensures valid access tokens by automatically refreshing when expired.
 * Uses file locks to prevent concurrent refresh attempts.
 */
export class TokenRefresher {
    tokenStorage;
    lock;
    constructor(tokenStorage) {
        this.tokenStorage = tokenStorage;
        // Use a separate lock for refresh operations
        this.lock = new FileLock('/tmp/.workbench-token-refresh.lock');
    }
    /**
     * Get a valid access token, refreshing if necessary
     *
     * @returns Valid access token
     * @throws Error if token file not found or refresh fails
     */
    async ensureValidToken() {
        // Load current tokens
        const tokens = await this.tokenStorage.load();
        const anthropicToken = tokens.anthropic;
        // If token is still valid, return it directly
        if (!this.tokenStorage.isExpired(anthropicToken)) {
            return anthropicToken.access;
        }
        // Token expired — refresh with file lock to prevent concurrent refresh
        return await this.lock.withLock(async () => {
            // Re-check after acquiring lock (another process may have refreshed)
            const reloadedTokens = await this.tokenStorage.load();
            const reloadedToken = reloadedTokens.anthropic;
            if (!this.tokenStorage.isExpired(reloadedToken)) {
                return reloadedToken.access;
            }
            // Perform token refresh
            const newToken = await this.refreshToken(reloadedToken.refresh);
            // Save new tokens
            const updatedTokens = {
                anthropic: newToken
            };
            await this.tokenStorage.save(updatedTokens);
            return newToken.access;
        });
    }
    /**
     * Refresh an expired token using the refresh token
     *
     * @param refreshToken - Current refresh token
     * @returns New token data
     * @throws Error if refresh fails
     */
    async refreshToken(refreshToken) {
        const requestBody = {
            grant_type: 'refresh_token',
            client_id: ANTHROPIC_CLIENT_ID,
            refresh_token: refreshToken
        };
        let response;
        try {
            response = await fetch(ANTHROPIC_TOKEN_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
        }
        catch (error) {
            throw new Error(`Network error during token refresh: ${error}`);
        }
        // Handle refresh errors
        if (response.status === 400 || response.status === 401) {
            throw new Error('Refresh token expired or invalid. Please re-authorize via OAuth flow in your browser.');
        }
        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Token refresh failed with status ${response.status}: ${errorText}`);
        }
        // Parse response
        let data;
        try {
            data = await response.json();
        }
        catch (error) {
            throw new Error(`Failed to parse token refresh response: ${error}`);
        }
        // Calculate expiry with buffer
        const expiresAt = Date.now() + (data.expires_in * 1000) - TOKEN_REFRESH_BUFFER_MS;
        return {
            type: 'oauth',
            access: data.access_token,
            refresh: data.refresh_token,
            expires: expiresAt
        };
    }
}
