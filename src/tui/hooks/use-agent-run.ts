// src/tui/hooks/use-agent-run.ts — Hook for managing agent runs

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AgentLoop } from '../../runtime/agent-loop.js';
import type { TypedEventBus } from '../../events/event-bus.js';
import type { RunResult } from '../../types/index.js';

export interface UseAgentRunOptions {
  agentLoop: AgentLoop | null;
  eventBus: TypedEventBus;
}

export interface UseAgentRunResult {
  isRunning: boolean;
  streamingText: string;
  error: string | null;
  lastResult: RunResult | null;
  sendMessage: (prompt: string, sessionId?: string) => void;
  abort: () => void;
}

/**
 * Custom hook that wraps AgentLoop + EventBus subscriptions
 * for streaming agent runs.
 */
export function useAgentRun({ agentLoop, eventBus }: UseAgentRunOptions): UseAgentRunResult {
  const [isRunning, setIsRunning] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const currentRunId = useRef<string | null>(null);

  // Subscribe to streaming events
  useEffect(() => {
    const unsubs = [
      eventBus.on('llm:stream:delta', ({ runId, text }) => {
        if (runId === currentRunId.current || currentRunId.current === null) {
          setStreamingText((prev) => prev + text);
        }
      }),
      eventBus.on('run:start', ({ runId }) => {
        currentRunId.current = runId;
        setStreamingText('');
        setError(null);
        setIsRunning(true);
      }),
      eventBus.on('run:end', ({ runId }) => {
        if (runId === currentRunId.current) {
          setIsRunning(false);
          setStreamingText('');
        }
      }),
      eventBus.on('run:error', ({ runId, error: errMsg }) => {
        if (runId === currentRunId.current) {
          setIsRunning(false);
          setError(errMsg);
          setStreamingText('');
        }
      }),
      eventBus.on('llm:stream:stop', ({ runId }) => {
        if (runId === currentRunId.current) {
          setStreamingText('');
        }
      }),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [eventBus]);

  const sendMessage = useCallback(
    (prompt: string, sessionId?: string) => {
      if (!agentLoop || isRunning) return;

      setIsRunning(true);
      setStreamingText('');
      setError(null);

      agentLoop
        .runStreaming(prompt, sessionId)
        .then((result) => {
          setLastResult(result);
          setIsRunning(false);
          setStreamingText('');
        })
        .catch((err: Error) => {
          setError(err.message);
          setIsRunning(false);
          setStreamingText('');
        });
    },
    [agentLoop, isRunning]
  );

  const abort = useCallback(() => {
    if (currentRunId.current && agentLoop) {
      agentLoop.cancel(currentRunId.current);
    }
  }, [agentLoop]);

  return { isRunning, streamingText, error, lastResult, sendMessage, abort };
}
