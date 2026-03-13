// src/tui/components/status-bar.tsx — Bottom status bar with usage bars (Gateway client)

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import { runStore } from '../stores.js';
import { getContextWindowSize } from '../../config/index.js';

export interface StatusBarProps {
  isRunning: boolean;
}

/** Shorten full model ID to display name: "claude-sonnet-4-20250514" → "sonnet-4" */
export function shortModelName(model: string): string {
  let name = model.replace(/^claude-/, '');
  name = name.replace(/-\d{8}$/, '');
  return name;
}

/** Format token count: 12345 → "12k", 1234567 → "1.2M" */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const k = tokens / 1_000;
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }
  return String(tokens);
}

/** Render a usage bar: [████░░░░░░] with color thresholds */
export function UsageBar({ ratio, width = 10 }: { ratio: number; width?: number }): React.ReactElement {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  let color: string;
  if (clamped > 0.8) {
    color = theme.destructive;
  } else if (clamped > 0.5) {
    color = theme.warning;
  } else {
    color = theme.primary;
  }

  return <Text color={color}>[{bar}]</Text>;
}

export function StatusBar({ isRunning }: StatusBarProps): React.ReactElement {
  const [model, setModel] = useState('');
  const [inputTokens, setInputTokens] = useState(0);
  const [stepCount, setStepCount] = useState(0);

  // Subscribe to runStore for model, tokens, steps
  useEffect(() => {
    const unsub = runStore.subscribe((state) => {
      setModel(state.model);
      setInputTokens(state.tokenUsage.input);
      setStepCount(state.stepCount);
    });
    return unsub;
  }, []);

  const displayModel = model ? shortModelName(model) : '';
  const contextMax = model ? getContextWindowSize(model) : undefined;
  const contextRatio = contextMax ? inputTokens / contextMax : 0;

  return (
    <Box borderStyle="single" borderColor={theme.border} paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        {displayModel ? <Text bold color={theme.foregroundSecondary}>{displayModel}</Text> : null}
        {displayModel ? <Text dimColor>|</Text> : null}

        {/* Context window bar */}
        {contextMax ? (
          <>
            <Text dimColor>ctx </Text>
            <UsageBar ratio={contextRatio} />
            <Text dimColor> {formatTokenCount(inputTokens)}/{formatTokenCount(contextMax)}</Text>
          </>
        ) : (
          inputTokens > 0 && <Text dimColor>ctx {formatTokenCount(inputTokens)}</Text>
        )}

        {stepCount > 0 && <Text dimColor> steps: {stepCount}</Text>}

        {isRunning && <Text color={theme.warning}> Running</Text>}
      </Box>
      <Text dimColor>Ctrl+B: Panels | Ctrl+N: New | Ctrl+C: Abort | /help</Text>
    </Box>
  );
}
