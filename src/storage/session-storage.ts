import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Session, SessionStatus, StorageMessage, StorageListOptions, StorageListResult } from '../types/index.js';
import { createNotFoundError } from '../types/errors.js';
import { normalizeListOptions } from '../types/index.js';

/**
 * SessionStorage — Manages session persistence as JSON files
 * 
 * Sessions are stored under ~/.workbench/sessions/<session-id>/session.json
 */
export class SessionStorage {
  private baseDir: string;

  constructor(baseDir?: string) {
    const workbenchHome = process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
    this.baseDir = baseDir ?? path.join(workbenchHome, 'sessions');
  }

  /**
   * Create a new session with a UUID-based ID
   * @param agentId - The ID of the agent associated with this session
   * @returns The newly created session
   */
  async create(agentId: string): Promise<Session> {
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    
    const session: Session = {
      id: sessionId,
      agentId,
      messages: [],
      toolCalls: [],
      status: 'active' as SessionStatus,
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
  async load(id: string): Promise<Session> {
    const sessionPath = this.getSessionPath(id);
    
    try {
      const content = await fs.readFile(sessionPath, 'utf-8');
      return JSON.parse(content) as Session;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          throw createNotFoundError('Session', id);
        }
      }
      throw new Error(`Failed to load session ${id}: ${error}`);
    }
  }

  /**
   * Save a session to disk atomically (write to temp, then rename)
   * @param session - The session to save
   */
  async save(session: Session): Promise<void> {
    const sessionDir = path.join(this.baseDir, session.id);
    const sessionPath = this.getSessionPath(session.id);
    const tempPath = `${sessionPath}.tmp`;

    // Ensure directory exists
    await fs.mkdir(sessionDir, { recursive: true });

    // Update timestamp
    session.updatedAt = new Date().toISOString();

    // Write to temp file
    await fs.writeFile(
      tempPath,
      JSON.stringify(session, null, 2),
      'utf-8'
    );

    // Atomic rename
    await fs.rename(tempPath, sessionPath);
  }

  /**
   * Add a message to an existing session
   * @param id - The session ID
   * @param message - The message to add
   */
  async addMessage(id: string, message: StorageMessage): Promise<void> {
    // Load session
    const session = await this.load(id);

    // Convert StorageMessage to Message format
    const sessionMessage = {
      role: message.role === 'tool_result' ? ('tool' as const) : message.role,
      content: message.content,
      toolCallId: 'toolCallId' in message ? message.toolCallId : undefined,
      toolUses: 'toolUses' in message ? message.toolUses : undefined,
      timestamp: message.timestamp,
    };

    // Append message
    session.messages.push(sessionMessage);

    // Save updated session
    await this.save(session);
  }

  /**
   * List all sessions with metadata (no full message load)
   * @param options - Pagination options (offset, limit, sort)
   * @returns Paginated result with session metadata
   */
  async list(options?: StorageListOptions): Promise<StorageListResult<{ id: string; agentId: string; status: SessionStatus; createdAt: string; updatedAt: string; messageCount: number }>> {
    const { offset, limit, sort } = normalizeListOptions(options);

    try {
      // Read all subdirectories in baseDir
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const sessionIds = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

      // Load metadata for each session
      const metadataList = await Promise.all(
        sessionIds.map(async (id) => {
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
          } catch {
            // Skip sessions that can't be loaded
            return null;
          }
        })
      );

      // Filter out nulls
      const validMetadata = metadataList.filter((metadata): metadata is NonNullable<typeof metadata> => metadata !== null);

      // Sort by createdAt
      validMetadata.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sort === 'desc' ? dateB - dateA : dateA - dateB;
      });

      // Get total count
      const total = validMetadata.length;

      // Apply pagination
      const data = validMetadata.slice(offset, offset + limit);

      return { data, total, offset, limit };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code === 'ENOENT') {
          // Base directory doesn't exist yet, return empty result
          return { data: [], total: 0, offset, limit };
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
  private getSessionPath(id: string): string {
    return path.join(this.baseDir, id, 'session.json');
  }
}
