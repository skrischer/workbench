// src/tui/components/chat-panel.tsx — Chat area with messages and text input

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { MessageList } from './message-list.js';
import type { ToolCallData } from './tool-call-block.js';
import { useRuntimeContext } from '../context.js';
import type { ChatMessage } from '../types.js';
import { theme } from '../theme.js';

export interface ChatPanelProps {
  messages: ChatMessage[];
  streamingText?: string;
  activeToolCalls?: ToolCallData[];
  onSendMessage: (prompt: string) => void;
  hasActiveSession: boolean;
  hasAnySessions?: boolean;
}

export function ChatPanel({ messages, streamingText, activeToolCalls, onSendMessage, hasActiveSession, hasAnySessions = true }: ChatPanelProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const { isRunning } = useRuntimeContext();

  const handleSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || isRunning) return;
      onSendMessage(trimmed);
      setInputValue('');
    },
    [isRunning, onSendMessage]
  );

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={theme.border} paddingX={1}>
      {!hasActiveSession && !hasAnySessions ? (
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text dimColor>Press Ctrl+N for new session</Text>
        </Box>
      ) : (
        <>
          <Box flexDirection="column" flexGrow={1} flexShrink={1} overflow="hidden">
            <MessageList messages={messages} streamingText={streamingText} activeToolCalls={activeToolCalls} />
          </Box>
          <Box flexGrow={0} flexShrink={0} borderStyle="single" borderColor={isRunning ? theme.warning : theme.success} paddingX={1}>
            {isRunning ? (
              <Text color={theme.warning}>Agent is running…</Text>
            ) : (
              <TextInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                placeholder="Type a message..."
              />
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
