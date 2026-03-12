// src/tui/app.tsx — Root TUI component

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { theme } from './theme.js';
import { TypedEventBus } from '../events/event-bus.js';
import { SessionStorage } from '../storage/session-storage.js';
import type { AgentLoop } from '../runtime/agent-loop.js';
import {
  EventBusContext,
  StorageContext,
  RuntimeContext,
  type RuntimeState,
} from './context.js';
import { SessionPanel } from './components/session-panel.js';
import { ChatPanel } from './components/chat-panel.js';
import { StatusBar } from './components/status-bar.js';
import { executeSlashCommand, type CommandContext } from './commands.js';
import { useAgentLoop } from './hooks/use-agent-loop.js';
import { useAgentRun } from './hooks/use-agent-run.js';
import type { ChatMessage } from './types.js';
import type { Session } from '../types/index.js';

export interface AppProps {
  eventBus?: TypedEventBus;
  sessionStorage?: SessionStorage;
  agentLoop?: AgentLoop | null;
}

export function App({
  eventBus: externalBus,
  sessionStorage: externalStorage,
  agentLoop: injectedAgentLoop,
}: AppProps): React.ReactElement {
  const { exit } = useApp();

  // Infrastructure — use provided or create new
  const [eventBus] = useState(() => externalBus ?? new TypedEventBus());
  const [sessionStorage] = useState(() => externalStorage ?? new SessionStorage());

  // AgentLoop — initialized async or injected for tests
  const { agentLoop, isInitializing, initError } = useAgentLoop(
    eventBus,
    sessionStorage,
    injectedAgentLoop
  );

  // Agent run state — wraps agentLoop + eventBus subscriptions
  const agentRun = useAgentRun({ agentLoop, eventBus });

  // UI state
  const [showSessionPanel, setShowSessionPanel] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionPanelFocused, setSessionPanelFocused] = useState(false);
  const [hasAnySessions, setHasAnySessions] = useState(true); // assume true until checked

  // Auto-load the most recent session on startup
  const startupLoaded = useRef(false);
  useEffect(() => {
    if (startupLoaded.current) return;
    startupLoaded.current = true;

    const loadLatest = async (): Promise<void> => {
      try {
        const result = await sessionStorage.list({ sort: 'desc', limit: 1 });
        if (result.data.length > 0) {
          setActiveSessionId(result.data[0].id);
          setHasAnySessions(true);
        } else {
          setHasAnySessions(false);
        }
      } catch {
        setHasAnySessions(false);
      }
    };
    void loadLatest();
  }, [sessionStorage]);

  // Runtime state — derived from agentRun
  const runtimeState: RuntimeState = {
    runId: null,
    isRunning: agentRun.isRunning,
    abort: agentRun.abort,
  };

  // Load session messages when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    const loadMessages = async (): Promise<void> => {
      try {
        const session: Session = await sessionStorage.load(activeSessionId);
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
  }, [activeSessionId, sessionStorage]);

  // When agent run finishes: append assistant response
  const lastResultRef = useRef(agentRun.lastResult);
  useEffect(() => {
    if (agentRun.lastResult && agentRun.lastResult !== lastResultRef.current && !agentRun.isRunning) {
      lastResultRef.current = agentRun.lastResult;
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: agentRun.lastResult.finalResponse,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }
  }, [agentRun.lastResult, agentRun.isRunning]);

  // When agent run errors: append error message
  const lastErrorRef = useRef(agentRun.error);
  useEffect(() => {
    if (agentRun.error && agentRun.error !== lastErrorRef.current) {
      lastErrorRef.current = agentRun.error;
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Error: ${agentRun.error}`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, [agentRun.error]);

  // Create a new session helper
  const createNewSession = useCallback(async (): Promise<string> => {
    const session = await sessionStorage.createSession();
    setActiveSessionId(session.id);
    setMessages([]);
    return session.id;
  }, [sessionStorage]);

  // Slash-command context
  const commandContext: CommandContext = {
    createSession: createNewSession,
    resumeSession: (sessionId: string) => {
      setActiveSessionId(sessionId);
    },
    listSessions: async () => {
      const result = await sessionStorage.list({ sort: 'desc', limit: 20 });
      return result.data.map((s: { id: string; status: string }) => ({
        id: s.id,
        status: s.status,
        promptPreview: '',
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

  // Handle sending a message — with slash-command support + agent run
  const handleSendMessage = useCallback(
    (prompt: string) => {
      // Check for slash commands
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

      // Start agent run — auto-create session if none active
      const startRun = async (): Promise<void> => {
        let sessionId = activeSessionId;
        if (!sessionId) {
          sessionId = await createNewSession();
        }
        agentRun.sendMessage(prompt, sessionId);
      };
      void startRun();
    },
    [commandContext, agentRun, activeSessionId, createNewSession]
  );

  // Handle session selection
  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setSessionPanelFocused(false);
  }, []);

  // Keyboard shortcuts
  useInput((input, key) => {
    // Ctrl+B — Toggle session panel
    if (key.ctrl && input === 'b') {
      setShowSessionPanel((prev) => !prev);
      return;
    }

    // Ctrl+N — New session
    if (key.ctrl && input === 'n') {
      void createNewSession();
      return;
    }

    // Ctrl+P — Focus session panel
    if (key.ctrl && input === 'p') {
      setSessionPanelFocused((prev) => !prev);
      return;
    }

    // Ctrl+L — Clear chat visually
    if (key.ctrl && input === 'l') {
      setMessages([]);
      return;
    }

    // Ctrl+C — Abort or exit
    if (key.ctrl && input === 'c') {
      if (runtimeState.isRunning) {
        runtimeState.abort();
        // Feedback message
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

  // Show initialization state
  if (isInitializing) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Initializing agent...</Text>
      </Box>
    );
  }

  if (initError) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.destructive}>Initialization failed: {initError}</Text>
        <Text dimColor>Run &quot;workbench auth&quot; to set up authentication.</Text>
      </Box>
    );
  }

  return (
    <EventBusContext.Provider value={eventBus}>
      <StorageContext.Provider value={sessionStorage}>
        <RuntimeContext.Provider value={runtimeState}>
          <Box flexDirection="column" width="100%" height="100%">
            <Box flexDirection="row" flexGrow={1}>
              {showSessionPanel && (
                <Box width="20%">
                  <SessionPanel
                    isFocused={sessionPanelFocused}
                    activeSessionId={activeSessionId}
                    onSelectSession={handleSelectSession}
                  />
                </Box>
              )}
              <Box width={showSessionPanel ? '80%' : '100%'}>
                <ChatPanel
                  messages={messages}
                  streamingText={agentRun.streamingText || undefined}
                  onSendMessage={handleSendMessage}
                  hasActiveSession={activeSessionId !== null}
                  hasAnySessions={hasAnySessions}
                />
              </Box>
            </Box>
            <StatusBar eventBus={eventBus} isRunning={runtimeState.isRunning} />
          </Box>
        </RuntimeContext.Provider>
      </StorageContext.Provider>
    </EventBusContext.Provider>
  );
}
