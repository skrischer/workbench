// src/types/agent.ts — Multi-Agent Type Definitions

import type { AgentConfig } from './index.js';

/** Agent role in multi-agent orchestration */
export type AgentRole = 'planner' | 'worker' | 'reviewer' | 'custom';

/** Current status of an agent instance */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'terminated';

/** Running agent instance with full state */
export interface AgentInstance {
  /** Unique agent instance identifier */
  id: string;

  /** Role of this agent in the multi-agent system */
  role: AgentRole;

  /** Human-readable agent name */
  name: string;

  /** Current execution status */
  status: AgentStatus;

  /** Agent configuration (model, tools, etc.) */
  config: AgentConfig;

  /** Parent agent ID if this is a sub-agent */
  parentId?: string;

  /** Session ID for this agent's conversation */
  sessionId: string;

  /** ISO timestamp when agent was created */
  createdAt: string;

  /** Arbitrary metadata for agent-specific data */
  metadata: Record<string, unknown>;
}

/** Configuration for spawning a new agent */
export interface SpawnConfig {
  /** Required: Agent role */
  role: AgentRole;

  /** Optional: Custom agent name (defaults to role-based name) */
  name?: string;

  /** Optional: Model override (defaults to parent's model) */
  model?: string;

  /** Optional: Custom system prompt */
  systemPrompt?: string;

  /** Optional: Tool whitelist for this agent */
  tools?: string[];

  /** Optional: Maximum execution steps (must be > 0 if provided) */
  maxSteps?: number;

  /** Optional: Working directory for agent */
  cwd?: string;
}

/** Message passed between agents */
export interface AgentMessage {
  /** Sender agent ID */
  from: string;

  /** Recipient agent ID */
  to: string;

  /** Message type */
  type: 'task' | 'result' | 'status' | 'error';

  /** Message payload (structure depends on type) */
  payload: unknown;

  /** ISO timestamp when message was created */
  timestamp: string;
}
