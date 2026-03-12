// src/tui/components/message-list.tsx — Scrollable message list with markdown

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { Markdown } from './markdown.js';
import { ToolCallBlock, type ToolCallData } from './tool-call-block.js';
import type { ChatMessage } from '../types.js';
import { roleColors, theme } from '../theme.js';

const ROLE_LABELS = {
  user: 'You',
  assistant: 'Assistant',
  tool: 'Tool',
} as const;

const SCROLL_STEP = 3;

export interface MessageListProps {
  messages: ChatMessage[];
  streamingText?: string;
  activeToolCalls?: ToolCallData[];
}

export function MessageList({ messages, streamingText, activeToolCalls }: MessageListProps): React.ReactElement {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;
  // Reserve space for status bar (1), input box (3), chat panel border (2), padding
  const availableHeight = Math.max(terminalHeight - 8, 5);

  // scrollOffset: 0 = bottom (newest), positive = scrolled up
  const [scrollOffset, setScrollOffset] = useState(0);

  // Auto-scroll to bottom when new messages arrive or streaming
  const totalItems = messages.length + (activeToolCalls?.length ?? 0) + (streamingText ? 1 : 0);
  useEffect(() => {
    setScrollOffset(0);
  }, [totalItems]);

  // Estimate visible messages: ~3 lines per message on average
  const linesPerMessage = 3;
  const maxVisibleMessages = Math.max(Math.floor(availableHeight / linesPerMessage), 2);

  // Calculate which messages to show
  const allMessages = messages;
  const endIndex = allMessages.length - scrollOffset;
  const startIndex = Math.max(0, endIndex - maxVisibleMessages);
  const visibleMessages = allMessages.slice(startIndex, Math.max(endIndex, 0));
  const hiddenAbove = startIndex;
  const hiddenBelow = scrollOffset;

  const handleScrollUp = useCallback(() => {
    setScrollOffset((prev) => Math.min(prev + SCROLL_STEP, Math.max(0, allMessages.length - 1)));
  }, [allMessages.length]);

  const handleScrollDown = useCallback(() => {
    setScrollOffset((prev) => Math.max(0, prev - SCROLL_STEP));
  }, []);

  // Keyboard: PageUp/PageDown for scrolling
  useInput((input, key) => {
    if (key.pageUp || (key.shift && key.upArrow)) {
      handleScrollUp();
    } else if (key.pageDown || (key.shift && key.downArrow)) {
      handleScrollDown();
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1}>
      {hiddenAbove > 0 && (
        <Box>
          <Text dimColor>↑ {hiddenAbove} more message{hiddenAbove !== 1 ? 's' : ''} above</Text>
        </Box>
      )}
      {visibleMessages.map((msg, visIdx) => {
        const originalIndex = startIndex + visIdx;

        // Render tool messages as ToolCallBlock
        if (msg.role === 'tool' && msg.toolName) {
          const toolData: ToolCallData = {
            toolId: msg.toolCallId ?? `tool-${originalIndex}`,
            toolName: msg.toolName,
            input: msg.toolInput ?? {},
            result: msg.content,
            isError: msg.content.startsWith('Error:'),
            isRunning: false,
          };
          return (
            <Box key={`${msg.timestamp}-${originalIndex}`} marginBottom={1}>
              <ToolCallBlock data={toolData} />
            </Box>
          );
        }

        return (
          <Box key={`${msg.timestamp}-${originalIndex}`} flexDirection="column" marginBottom={1}>
            <Text bold color={roleColors[msg.role]}>
              {ROLE_LABELS[msg.role]}
            </Text>
            {msg.role === 'assistant' ? (
              <Markdown>{msg.content}</Markdown>
            ) : (
              <Text color={roleColors[msg.role]} wrap="wrap">
                {msg.content}
              </Text>
            )}
          </Box>
        );
      })}
      {scrollOffset === 0 && activeToolCalls?.map((tc) => (
        <Box key={tc.toolId} marginBottom={1}>
          <ToolCallBlock data={tc} />
        </Box>
      ))}
      {scrollOffset === 0 && streamingText ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={theme.foreground}>Assistant</Text>
          <Markdown>{streamingText + ' ▌'}</Markdown>
        </Box>
      ) : null}
      {hiddenBelow > 0 && (
        <Box>
          <Text dimColor>↓ {hiddenBelow} more message{hiddenBelow !== 1 ? 's' : ''} below</Text>
        </Box>
      )}
    </Box>
  );
}
