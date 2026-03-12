// src/tui/components/chat-input.tsx — Chat input component

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export interface ChatInputProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Chat text input with submit on Enter.
 * Handles slash-command detection (prefix /).
 */
export function ChatInput({ onSubmit, disabled = false, placeholder = 'Type a message...' }: ChatInputProps): React.ReactElement {
  const [value, setValue] = useState('');

  const handleSubmit = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed || disabled) return;
      onSubmit(trimmed);
      setValue('');
    },
    [onSubmit, disabled]
  );

  if (disabled) {
    return (
      <Box paddingX={1}>
        <Text color="yellow">Agent is running…</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1}>
      <Text color="green">&gt; </Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        placeholder={placeholder}
      />
    </Box>
  );
}
