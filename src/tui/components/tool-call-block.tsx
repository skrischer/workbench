// src/tui/components/tool-call-block.tsx — Collapsible tool-call display

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

export interface ToolCallData {
  toolId: string;
  toolName: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  isRunning?: boolean;
  durationMs?: number;
}

export interface ToolCallBlockProps {
  data: ToolCallData;
  isFocused?: boolean;
}

/**
 * Collapsible tool-call block.
 * Compact: [tool_name] ▶ (collapsed)
 * Expanded: Header + Input (JSON) + Output (Text)
 */
export function ToolCallBlock({ data, isFocused = false }: ToolCallBlockProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  // Spinner animation for running state
  useEffect(() => {
    if (!data.isRunning) return;
    const timer = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % spinnerChars.length);
    }, 80);
    return () => clearInterval(timer);
  }, [data.isRunning, spinnerChars.length]);

  // Toggle on Enter/Space when focused
  useInput(
    (input, key) => {
      if (key.return || input === ' ') {
        setExpanded((prev) => !prev);
      }
    },
    { isActive: isFocused }
  );

  // Status color
  const statusColor = data.isRunning ? theme.warning : data.isError ? theme.destructive : theme.success;

  // Status icon
  const statusIcon = data.isRunning
    ? spinnerChars[spinnerFrame]
    : data.isError
      ? '✗'
      : '✓';

  // Duration text
  const durationText = data.durationMs !== undefined ? ` ${data.durationMs.toFixed(0)}ms` : '';

  if (!expanded) {
    return (
      <Box>
        <Text color={statusColor}>
          {statusIcon} [{data.toolName}]{durationText} {expanded ? '▼' : '▶'}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={statusColor} paddingX={1}>
      <Text color={statusColor} bold>
        {statusIcon} [{data.toolName}]{durationText} ▼
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor bold>Input:</Text>
        <Text wrap="wrap">{JSON.stringify(data.input, null, 2)}</Text>
      </Box>
      {data.result !== undefined && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor bold>Output:</Text>
          <Text color={data.isError ? theme.destructive : undefined} wrap="wrap">
            {data.result}
          </Text>
        </Box>
      )}
    </Box>
  );
}
