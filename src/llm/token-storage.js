import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { FileLock } from './file-lock.js';
/**
 * TokenStorage — Manages OAuth tokens with file locking
 *
 * Reads and writes tokens.json with exclusive file locks to prevent race conditions.
 */
export class TokenStorage {
    tokenPath;
    lockPath;
    lock;
    constructor(tokenPath) {
        this.tokenPath = tokenPath ?? path.join(homedir(), '.workbench', 'tokens.json');
        this.lockPath = `${this.tokenPath}.lock`;
        this.lock = new FileLock(this.lockPath);
    }
    /**
     * Load tokens from file
     * @throws Error if token file does not exist or is invalid JSON
     */
    async load() {
        try {
            const content = await fs.readFile(this.tokenPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error) {
                const err = error;
                if (err.code === 'ENOENT') {
                    throw new Error(`Token file not found: ${this.tokenPath}`);
                }
            }
            throw new Error(`Failed to load token file: ${error}`);
        }
    }
    /**
     * Save tokens to file with exclusive lock
     * Creates parent directory if needed
     */
    async save(tokens) {
        await this.lock.withLock(async () => {
            // Ensure parent directory exists
            const dir = path.dirname(this.tokenPath);
            await fs.mkdir(dir, { recursive: true });
            // Write tokens as formatted JSON
            await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2), 'utf-8');
        });
    }
    /**
     * Check if token data is expired
     * @returns true if current time >= expires timestamp
     */
    isExpired(data) {
        return Date.now() >= data.expires;
    }
    /**
     * Get the current access token
     * @throws Error if token file not found or token is expired
     */
    async getAccessToken() {
        const tokens = await this.load();
        const anthropicToken = tokens.anthropic;
        if (this.isExpired(anthropicToken)) {
            throw new Error('Access token has expired');
        }
        return anthropicToken.access;
    }
}
