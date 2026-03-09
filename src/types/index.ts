// src/types/index.ts — Shared Type Definitions for Workbench

/** Agent runtime configuration (loaded from file or defaults) */
export interface AgentConfig {
  model: string;
  systemPrompt: string;
  tools?: string[]; // Tool name whitelist
  maxSteps: number;
}

/** Agent instance (runtime entity with ID) */
export interface Agent {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  tools: string[]; // Tool name whitelist
  maxSteps: number;
}

/** Tool definition */
export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

/** Message in a session */
export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  timestamp: string;
}

/** User message for session storage */
export interface UserMessage {
  role: 'user';
  content: string;
  timestamp: string;
}

/** Assistant message for session storage */
export interface AssistantMessage {
  role: 'assistant';
  content: string;
  timestamp: string;
}

/** Tool result message for session storage */
export interface ToolResultMessage {
  role: 'tool_result';
  content: string;
  toolCallId: string;
  timestamp: string;
}

/** Union type for storage messages */
export type StorageMessage = UserMessage | AssistantMessage | ToolResultMessage;

/** Tool call record */
export interface ToolCall {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  result?: ToolResult;
  timestamp: string;
}

/** Session status */
export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed';

/** Session — conversation context */
export interface Session {
  id: string;
  agentId: string;
  messages: Message[];
  toolCalls: ToolCall[];
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

/** Run status */
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Run — a concrete agent execution */
export interface Run {
  id: string;
  sessionId: string;
  agentId: string;
  status: RunStatus;
  startState: Record<string, unknown>;
  toolHistory: ToolCall[];
  result?: string;
  startedAt: string;
  completedAt?: string;
}

/** Task — structured task description */
export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done' | 'blocked';
  assignedTo?: string;
  planId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Step — atomic execution unit */
export interface Step {
  id: string;
  planId: string;
  title: string;
  description: string;
  order: number;
  status: 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
  result?: string;
}

/** Plan — task summary with steps */
export interface Plan {
  id: string;
  taskId: string;
  title: string;
  description: string;
  steps: Step[];
  status: 'draft' | 'active' | 'completed' | 'failed';
  createdAt: string;
}

/** OAuth token data stored in tokens.json */
export interface TokenData {
  type: 'oauth';
  access: string;
  refresh: string;
  expires: number;
}

/** Structure of the tokens.json file */
export interface TokenFile {
  anthropic: TokenData;
}

/** Content block types from Anthropic Messages API */
export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

/** Message for Anthropic Messages API */
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

/** Tool definition for Anthropic API */
export interface LLMToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** LLM configuration */
export interface LLMConfig {
  model: string;
  maxTokens: number;
  apiUrl?: string;
}

/** Usage stats from API response */
export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
}

/** Response from Anthropic Messages API */
export interface LLMResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: ContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  usage: LLMUsage;
}

/** Result of an agent run */
export interface RunResult {
  sessionId: string;
  steps: number;
  finalResponse: string;
  tokenUsage: LLMUsage;
  status: 'completed' | 'max_steps_reached' | 'failed';
}

// Re-export event types
export type { EventMap, EventListener, Unsubscribe, TokenUsage, StepTokenUsage } from './events.js';
// Memory System Types
export type {
  MemoryType,
  MemorySource,
  MemoryEntry,
  MemoryQuery,
  MemoryResult,
  EmbeddingConfig,
} from './memory.js';
// Multi-Agent System Types
export type {
  AgentRole,
  AgentStatus,
  AgentInstance,
  SpawnConfig,
  AgentMessage,
} from './agent.js';
// Workflow System Types
export type {
  WorkflowDefinition,
  WorkflowInput,
  WorkflowResult,
} from './workflow.js';
// Error Types
export { StorageError, NotFoundError, isNotFoundError, createNotFoundError } from './errors.js';
