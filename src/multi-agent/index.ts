// src/multi-agent/index.ts — Multi-Agent System Exports

export { validateSpawnConfig, validateAgentMessage } from './validation.js';
export { MessageBus } from './message-bus.js';
export type {
  AgentRole,
  AgentStatus,
  AgentInstance,
  SpawnConfig,
  AgentMessage,
} from '../types/agent.js';
