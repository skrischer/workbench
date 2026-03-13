// src/tui/app.tsx — Root TUI component (Gateway WebSocket client)

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { theme } from './theme.js';
import { TuiWsProvider, useTuiWs, type WsStatus } from './providers/ws-provider.js';
import { useWsDispatcher } from '../shared/ws-client/use-ws-dispatcher.js';
import { chatStore, runStore, sessionStore } from './stores.js';
import { RuntimeContext, type RuntimeState } from './context.js';
import { SessionPanel } from './components/session-panel.js';
import { ChatPanel } from './components/chat-panel.js';
import { StatusBar } from './components/status-bar.js';
import { executeSlashCommand, type CommandContext } from './commands.js';
import { getGatewayWsUrl } from '../gateway/health.js';
import type { ChatMessage, SessionPreview } from './types.js';
import type { Session } from '../types/index.js';

export interface AppProps {
  gatewayUrl?: string;
}

/**
 * Inner app that has access to the WS context.
 */
function AppInner(): React.ReactElement {
  const { exit } = useApp();
  const { status, lastMessage, sendCommand } = useTuiWs();

  // Route WS events → Zustand stores
  const stores = {
    chatStore: chatStore.getState(),
    runStore: runStore.getState(),
  };
  useWsDispatcher(lastMessage, stores);

  // UI state
  const [showSessionPanel, setShowSessionPanel] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionPanelFocused, setSessionPanelFocused] = useState(false);
  const [hasAnySessions, setHasAnySessions] = useState(true);

  // Track streaming state from stores
  const [streamingText, setStreamingText] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  // Subscribe to store changes
  useEffect(() => {
    const unsubChat = chatStore.subscribe((state) => {
      setStreamingText(state.streamingText);
    });
    const unsubRun = runStore.subscribe((state) => {
      setIsRunning(state.isRunning);
    });
    return () => {
      unsubChat();
      unsubRun();
    };
  }, []);

  // Auto-load sessions once connected
  const startupLoaded = useRef(false);
  useEffect(() => {
    if (status !== 'open' || startupLoaded.current) return;
    startupLoaded.current = true;

    const loadLatest = async (): Promise<void> => {
      try {
        const sessions = await sendCommand('list_sessions') as SessionPreview[];
        if (sessions.length > 0) {
          setActiveSessionId(sessions[0].id);
          setHasAnySessions(true);
          sessionStore.getState().setSessions(sessions);
        } else {
          setHasAnySessions(false);
        }
      } catch {
        setHasAnySessions(false);
      }
    };
    void loadLatest();
  }, [status, sendCommand]);

  // Load session messages when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId || status !== 'open') {
      setMessages([]);
      return;
    }

    const loadMessages = async (): Promise<void> => {
      try {
        const session = await sendCommand('load_session', { id: activeSessionId }) as Session;
        const chatMessages: ChatMessage[] = session.messages.map((msg) => ({
          role: msg.role === 'system' ? 'assistant' : msg.role === 'tool' ? 'tool' : msg.role,
          content: msg.content,
          toolCallId: msg.toolCallId,
          timestamp: msg.timestamp,
        }));
        setMessages(chatMessages);
      } catch {
        setMessages([]);
      }
    };

    void loadMessages();
  }, [activeSessionId, status, sendCommand]);

  // When run ends, reload session messages to get final assistant response
  const prevRunning = useRef(false);
  useEffect(() => {
    if (prevRunning.current && !isRunning && activeSessionId && status === 'open') {
      // Run just ended — reload messages from server
      const reload = async (): Promise<void> => {
        try {
          const session = await sendCommand('load_session', { id: activeSessionId }) as Session;
          const chatMessages: ChatMessage[] = session.messages.map((msg) => ({
            role: msg.role === 'system' ? 'assistant' : msg.role === 'tool' ? 'tool' : msg.role,
            content: msg.content,
            toolCallId: msg.toolCallId,
            timestamp: msg.timestamp,
          }));
          setMessages(chatMessages);
        } catch {
          // Keep current messages
        }
      };
      void reload();
    }
    prevRunning.current = isRunning;
  }, [isRunning, activeSessionId, status, sendCommand]);

  // Runtime state for context
  const abort = useCallback(() => {
    const runId = runStore.getState().activeRunId;
    if (runId) {
      void sendCommand('abort_run', { runId });
    }
  }, [sendCommand]);

  const runtimeState: RuntimeState = {
    runId: runStore.getState().activeRunId,
    isRunning,
    abort,
  };

  // Create a new session
  const createNewSession = useCallback(async (): Promise<string> => {
    const session = await sendCommand('create_session') as { id: string };
    setActiveSessionId(session.id);
    setMessages([]);
    return session.id;
  }, [sendCommand]);

  // Slash-command context
  const commandContext: CommandContext = {
    createSession: createNewSession,
    resumeSession: (sessionId: string) => {
      setActiveSessionId(sessionId);
    },
    listSessions: async () => {
      const sessions = await sendCommand('list_sessions') as SessionPreview[];
      return sessions.map((s) => ({
        id: s.id,
        status: s.status,
        promptPreview: s.promptPreview,
      }));
    },
    setError: (msg: string) => {
      const sysMsg: ChatMessage = {
        role: 'assistant',
        content: msg,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, sysMsg]);
    },
  };

  // Handle sending a message
  const handleSendMessage = useCallback(
    (prompt: string) => {
      if (prompt.startsWith('/')) {
        void executeSlashCommand(prompt, commandContext);
        return;
      }

      const userMsg: ChatMessage = {
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      const startRun = async (): Promise<void> => {
        let sessionId = activeSessionId;
        if (!sessionId) {
          sessionId = await createNewSession();
        }
        chatStore.getState().resetStreaming();
        void sendCommand('send_message', { sessionId, prompt });
      };
      void startRun();
    },
    [commandContext, sendCommand, activeSessionId, createNewSession]
  );

  // Handle session selection
  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setSessionPanelFocused(false);
  }, []);

  // Keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'b') {
      setShowSessionPanel((prev) => !prev);
      return;
    }
    if (key.ctrl && input === 'n') {
      void createNewSession();
      return;
    }
    if (key.ctrl && input === 'p') {
      setSessionPanelFocused((prev) => !prev);
      return;
    }
    if (key.ctrl && input === 'l') {
      setMessages([]);
      return;
    }
    if (key.ctrl && input === 'c') {
      if (runtimeState.isRunning) {
        runtimeState.abort();
        const cancelMsg: ChatMessage = {
          role: 'assistant',
          content: 'Run cancelled.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, cancelMsg]);
      } else {
        exit();
      }
    }
  });

  // Connection state UI
  if (status === 'connecting') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Connecting to Gateway...</Text>
      </Box>
    );
  }

  if (status === 'error' || status === 'closed') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.destructive}>Gateway nicht erreichbar.</Text>
        <Text dimColor>Starte den Gateway: workbench gateway</Text>
      </Box>
    );
  }

  // Convert streaming tool calls from Map to array for ChatPanel
  const streamingToolCallsMap = chatStore.getState().streamingToolCalls;
  const activeToolCalls = [...streamingToolCallsMap.values()].map((tc) => ({
    toolId: tc.toolId,
    toolName: tc.toolName,
    input: typeof tc.input === 'string' ? (tc.input ? JSON.parse(tc.input) as Record<string, unknown> : {}) : {},
    isRunning: tc.status === 'running',
    result: tc.result,
    isError: tc.status === 'error',
    durationMs: tc.durationMs,
  }));

  return (
    <RuntimeContext.Provider value={runtimeState}>
      <Box flexDirection="column" width="100%" height="100%">
        <Box flexDirection="row" flexGrow={1} flexShrink={1} overflow="hidden">
          {showSessionPanel && (
            <Box width="20%" flexShrink={0}>
              <SessionPanel
                isFocused={sessionPanelFocused}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
              />
            </Box>
          )}
          <Box flexGrow={1} flexShrink={1}>
            <ChatPanel
              messages={messages}
              streamingText={streamingText || undefined}
              activeToolCalls={activeToolCalls}
              onSendMessage={handleSendMessage}
              hasActiveSession={activeSessionId !== null}
              hasAnySessions={hasAnySessions}
            />
          </Box>
        </Box>
        <StatusBar isRunning={isRunning} />
      </Box>
    </RuntimeContext.Provider>
  );
}

export function App({ gatewayUrl }: AppProps): React.ReactElement {
  const url = gatewayUrl ?? getGatewayWsUrl();

  return (
    <TuiWsProvider url={url}>
      <AppInner />
    </TuiWsProvider>
  );
}
