// src/tui/hooks/use-agent-run.ts — Hook for managing agent runs

import { useState, useCallback, useEffect, useRef } from 'react';
import type { AgentLoop } from '../../runtime/agent-loop.js';
import type { TypedEventBus } from '../../events/event-bus.js';
import type { RunResult } from '../../types/index.js';
import type { ToolCallData } from '../components/tool-call-block.js';

export interface UseAgentRunOptions {
  agentLoop: AgentLoop | null;
  eventBus: TypedEventBus;
}

export interface UseAgentRunResult {
  isRunning: boolean;
  streamingText: string;
  error: string | null;
  lastResult: RunResult | null;
  activeToolCalls: ToolCallData[];
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
  const toolCallsRef = useRef<Map<string, ToolCallData>>(new Map());
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallData[]>([]);
  const currentRunId = useRef<string | null>(null);

  // Subscribe to streaming events
  useEffect(() => {
    const updateToolCallsState = (): void => {
      setActiveToolCalls([...toolCallsRef.current.values()]);
    };

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
        toolCallsRef.current.clear();
        updateToolCallsState();
      }),
      eventBus.on('run:end', ({ runId }) => {
        if (runId === currentRunId.current) {
          setIsRunning(false);
          setStreamingText('');
          toolCallsRef.current.clear();
          updateToolCallsState();
        }
      }),
      eventBus.on('run:error', ({ runId, error: errMsg }) => {
        if (runId === currentRunId.current) {
          setIsRunning(false);
          setError(errMsg);
          setStreamingText('');
          toolCallsRef.current.clear();
          updateToolCallsState();
        }
      }),
      eventBus.on('llm:stream:stop', ({ runId }) => {
        if (runId === currentRunId.current) {
          setStreamingText('');
        }
      }),
      eventBus.on('llm:stream:tool_start', ({ runId, toolName, toolId }) => {
        if (runId === currentRunId.current) {
          toolCallsRef.current.set(toolId, {
            toolId,
            toolName,
            input: {},
            isRunning: true,
          });
          updateToolCallsState();
        }
      }),
      eventBus.on('tool:call', ({ runId, toolName, input, stepIndex }) => {
        if (runId === currentRunId.current) {
          const toolId = `tool-${stepIndex}`;
          toolCallsRef.current.set(toolId, {
            toolId,
            toolName,
            input: (input as Record<string, unknown>) ?? {},
            isRunning: true,
          });
          updateToolCallsState();
        }
      }),
      eventBus.on('tool:result', ({ runId, toolName, result, durationMs }) => {
        if (runId === currentRunId.current) {
          // Find the matching running tool call by name
          for (const [id, tc] of toolCallsRef.current) {
            if (tc.toolName === toolName && tc.isRunning) {
              toolCallsRef.current.set(id, {
                ...tc,
                isRunning: false,
                result: typeof result === 'string' ? result : JSON.stringify(result),
                isError: typeof result === 'object' && result !== null && 'isError' in result && (result as { isError?: boolean }).isError === true,
                durationMs,
              });
              break;
            }
          }
          updateToolCallsState();
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

  return { isRunning, streamingText, error, lastResult, activeToolCalls, sendMessage, abort };
}
