// src/tui/app.tsx — Root TUI component

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { TypedEventBus } from '../events/event-bus.js';
import { SessionStorage } from '../storage/session-storage.js';
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
import type { ChatMessage } from './types.js';
import type { Session } from '../types/index.js';

export interface AppProps {
  eventBus?: TypedEventBus;
  sessionStorage?: SessionStorage;
}

export function App({ eventBus: externalBus, sessionStorage: externalStorage }: AppProps): React.ReactElement {
  const { exit } = useApp();

  // Infrastructure — use provided or create new
  const [eventBus] = useState(() => externalBus ?? new TypedEventBus());
  const [sessionStorage] = useState(() => externalStorage ?? new SessionStorage());

  // UI state
  const [showSessionPanel, setShowSessionPanel] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | undefined>(undefined);
  const [sessionPanelFocused, setSessionPanelFocused] = useState(false);

  // Runtime state
  const [runtimeState, setRuntimeState] = useState<RuntimeState>({
    runId: null,
    isRunning: false,
    abort: () => {},
  });

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

  // Handle sending a message — with slash-command support
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
    },
    [commandContext]
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
      setStreamingText(undefined);
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
        setStreamingText(undefined);
      } else {
        exit();
      }
    }
  });

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
                  streamingText={streamingText}
                  onSendMessage={handleSendMessage}
                  hasActiveSession={activeSessionId !== null}
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
