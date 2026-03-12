// src/tui/components/chat-panel.tsx — Chat area with messages and text input

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { MessageList } from './message-list.js';
import { useRuntimeContext } from '../context.js';
import type { ChatMessage } from '../types.js';

export interface ChatPanelProps {
  messages: ChatMessage[];
  streamingText?: string;
  onSendMessage: (prompt: string) => void;
  hasActiveSession: boolean;
}

export function ChatPanel({ messages, streamingText, onSendMessage, hasActiveSession }: ChatPanelProps): React.ReactElement {
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
    <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor="gray" paddingX={1}>
      {!hasActiveSession ? (
        <Box flexGrow={1} alignItems="center" justifyContent="center">
          <Text dimColor>Press Ctrl+N for new session</Text>
        </Box>
      ) : (
        <>
          <Box flexDirection="column" flexGrow={1} overflow="hidden">
            <MessageList messages={messages} streamingText={streamingText} />
          </Box>
          <Box borderStyle="single" borderColor={isRunning ? 'yellow' : 'green'} paddingX={1}>
            {isRunning ? (
              <Text color="yellow">Agent is running…</Text>
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
