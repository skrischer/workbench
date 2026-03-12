// src/tui/hooks/use-agent-loop.ts — Hook for AgentLoop initialization

import { useState, useEffect, useRef } from 'react';
import { homedir } from 'node:os';
import path from 'node:path';
import { loadAgentConfig } from '../../agent/config.js';
import { AnthropicClient } from '../../llm/anthropic-client.js';
import { TokenRefresher } from '../../llm/token-refresh.js';
import { TokenStorage } from '../../llm/token-storage.js';
import { AgentLoop } from '../../runtime/agent-loop.js';
import { createDefaultTools } from '../../tools/defaults.js';
import type { SessionStorage } from '../../storage/session-storage.js';
import type { TypedEventBus } from '../../events/event-bus.js';

export interface UseAgentLoopResult {
  agentLoop: AgentLoop | null;
  isInitializing: boolean;
  initError: string | null;
}

/**
 * Hook that initializes an AgentLoop with all required dependencies.
 * Handles async setup of tokens, config, tools, and client.
 *
 * If `injectedAgentLoop` is provided, skips initialization entirely (for tests).
 */
export function useAgentLoop(
  eventBus: TypedEventBus,
  sessionStorage: SessionStorage,
  injectedAgentLoop?: AgentLoop | null
): UseAgentLoopResult {
  const [agentLoop, setAgentLoop] = useState<AgentLoop | null>(injectedAgentLoop ?? null);
  const [isInitializing, setIsInitializing] = useState(injectedAgentLoop === undefined);
  const [initError, setInitError] = useState<string | null>(null);
  const initStarted = useRef(false);

  useEffect(() => {
    // Skip if injected or already started
    if (injectedAgentLoop !== undefined || initStarted.current) return;
    initStarted.current = true;

    const init = async (): Promise<void> => {
      try {
        const agentConfig = await loadAgentConfig();
        const workbenchHome = process.env.WORKBENCH_HOME ?? path.join(homedir(), '.workbench');
        const tokenPath = path.join(workbenchHome, 'tokens.json');
        const tokenStorage = new TokenStorage(tokenPath);
        const tokenRefresher = new TokenRefresher(tokenStorage);
        await tokenStorage.load();

        const anthropicClient = new AnthropicClient(tokenRefresher, {
          model: agentConfig.model,
          apiUrl: process.env.ANTHROPIC_API_URL,
        });

        const toolRegistry = createDefaultTools();

        if (!agentConfig.tools || agentConfig.tools.length === 0) {
          agentConfig.tools = toolRegistry.list();
        }

        const loop = new AgentLoop(
          anthropicClient,
          sessionStorage,
          toolRegistry,
          agentConfig,
          eventBus
        );
        setAgentLoop(loop);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setInitError(message);
      } finally {
        setIsInitializing(false);
      }
    };

    void init();
  }, [eventBus, sessionStorage, injectedAgentLoop]);

  return { agentLoop, isInitializing, initError };
}
