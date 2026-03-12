// src/tui/components/message-list.tsx — Scrollable message list with markdown

import React from 'react';
import { Box, Text } from 'ink';
import { Markdown } from './markdown.js';
import { ToolCallBlock, type ToolCallData } from './tool-call-block.js';
import type { ChatMessage } from '../types.js';

const ROLE_COLORS = {
  user: 'green',
  assistant: 'white',
  tool: 'gray',
} as const;

const ROLE_LABELS = {
  user: 'You',
  assistant: 'Assistant',
  tool: 'Tool',
} as const;

export interface MessageListProps {
  messages: ChatMessage[];
  streamingText?: string;
  activeToolCalls?: ToolCallData[];
}

export function MessageList({ messages, streamingText, activeToolCalls }: MessageListProps): React.ReactElement {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg, index) => {
        // Render tool messages as ToolCallBlock
        if (msg.role === 'tool' && msg.toolName) {
          const toolData: ToolCallData = {
            toolId: msg.toolCallId ?? `tool-${index}`,
            toolName: msg.toolName,
            input: msg.toolInput ?? {},
            result: msg.content,
            isError: msg.content.startsWith('Error:'),
            isRunning: false,
          };
          return (
            <Box key={`${msg.timestamp}-${index}`} marginBottom={1}>
              <ToolCallBlock data={toolData} />
            </Box>
          );
        }

        return (
          <Box key={`${msg.timestamp}-${index}`} flexDirection="column" marginBottom={1}>
            <Text bold color={ROLE_COLORS[msg.role]}>
              {ROLE_LABELS[msg.role]}
            </Text>
            {msg.role === 'assistant' ? (
              <Markdown>{msg.content}</Markdown>
            ) : (
              <Text color={ROLE_COLORS[msg.role]} wrap="wrap">
                {msg.content}
              </Text>
            )}
          </Box>
        );
      })}
      {activeToolCalls?.map((tc) => (
        <Box key={tc.toolId} marginBottom={1}>
          <ToolCallBlock data={tc} />
        </Box>
      ))}
      {streamingText ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color="white">Assistant</Text>
          <Text wrap="wrap">{streamingText}<Text color="cyan">▌</Text></Text>
        </Box>
      ) : null}
    </Box>
  );
}
