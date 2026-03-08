import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
/**
 * SessionStorage — Manages session persistence as JSON files
 *
 * Sessions are stored under ~/.workbench/sessions/<session-id>/session.json
 */
export class SessionStorage {
    baseDir;
    constructor(baseDir) {
        const workbenchHome = process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
        this.baseDir = baseDir ?? path.join(workbenchHome, 'sessions');
    }
    /**
     * Create a new session with a UUID-based ID
     * @param agentId - The ID of the agent associated with this session
     * @returns The newly created session
     */
    async create(agentId) {
        const sessionId = randomUUID();
        const now = new Date().toISOString();
        const session = {
            id: sessionId,
            agentId,
            messages: [],
            toolCalls: [],
            status: 'active',
            createdAt: now,
            updatedAt: now,
        };
        // Create session directory
        const sessionDir = path.join(this.baseDir, sessionId);
        await fs.mkdir(sessionDir, { recursive: true });
        // Save initial session
        await this.save(session);
        return session;
    }
    /**
     * Load a session from disk
     * @param id - The session ID
     * @returns The loaded session
     * @throws Error if session file does not exist or is invalid
     */
    async load(id) {
        const sessionPath = this.getSessionPath(id);
        try {
            const content = await fs.readFile(sessionPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error) {
                const err = error;
                if (err.code === 'ENOENT') {
                    throw new Error(`Session not found: ${id}`);
                }
            }
            throw new Error(`Failed to load session ${id}: ${error}`);
        }
    }
    /**
     * Save a session to disk atomically (write to temp, then rename)
     * @param session - The session to save
     */
    async save(session) {
        const sessionDir = path.join(this.baseDir, session.id);
        const sessionPath = this.getSessionPath(session.id);
        const tempPath = `${sessionPath}.tmp`;
        // Ensure directory exists
        await fs.mkdir(sessionDir, { recursive: true });
        // Update timestamp
        session.updatedAt = new Date().toISOString();
        // Write to temp file
        await fs.writeFile(tempPath, JSON.stringify(session, null, 2), 'utf-8');
        // Atomic rename
        await fs.rename(tempPath, sessionPath);
    }
    /**
     * Add a message to an existing session
     * @param id - The session ID
     * @param message - The message to add
     */
    async addMessage(id, message) {
        // Load session
        const session = await this.load(id);
        // Convert StorageMessage to Message format
        const sessionMessage = {
            role: message.role === 'tool_result' ? 'tool' : message.role,
            content: message.content,
            toolCallId: 'toolCallId' in message ? message.toolCallId : undefined,
            timestamp: message.timestamp,
        };
        // Append message
        session.messages.push(sessionMessage);
        // Save updated session
        await this.save(session);
    }
    /**
     * List all sessions with metadata (no full message load)
     * @returns Array of session metadata
     */
    async list() {
        try {
            // Read all subdirectories in baseDir
            const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
            const sessionIds = entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name);
            // Load metadata for each session
            const metadataList = await Promise.all(sessionIds.map(async (id) => {
                try {
                    const session = await this.load(id);
                    return {
                        id: session.id,
                        agentId: session.agentId,
                        status: session.status,
                        createdAt: session.createdAt,
                        updatedAt: session.updatedAt,
                        messageCount: session.messages.length,
                    };
                }
                catch {
                    // Skip sessions that can't be loaded
                    return null;
                }
            }));
            // Filter out nulls and return
            return metadataList.filter((metadata) => metadata !== null);
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error) {
                const err = error;
                if (err.code === 'ENOENT') {
                    // Base directory doesn't exist yet, return empty list
                    return [];
                }
            }
            throw new Error(`Failed to list sessions: ${error}`);
        }
    }
    /**
     * Get the file path for a session
     * @param id - The session ID
     * @returns The full path to the session.json file
     */
    getSessionPath(id) {
        return path.join(this.baseDir, id, 'session.json');
    }
}
