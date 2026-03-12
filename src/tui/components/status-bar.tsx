// src/tui/components/status-bar.tsx — Bottom status bar

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { TypedEventBus } from '../../events/event-bus.js';

export interface StatusBarProps {
  eventBus: TypedEventBus;
  isRunning: boolean;
  model?: string;
}

export function StatusBar({ eventBus, isRunning, model }: StatusBarProps): React.ReactElement {
  const [tokenIn, setTokenIn] = useState(0);
  const [tokenOut, setTokenOut] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [currentModel, setCurrentModel] = useState(model ?? '');

  useEffect(() => {
    const unsubs = [
      eventBus.on('llm:response', ({ model: m, tokenUsage }) => {
        setCurrentModel(m);
        setTokenIn((prev) => prev + tokenUsage.inputTokens);
        setTokenOut((prev) => prev + tokenUsage.outputTokens);
      }),
      eventBus.on('run:step', () => {
        setStepCount((prev) => prev + 1);
      }),
      eventBus.on('run:start', () => {
        setStepCount(0);
        setTokenIn(0);
        setTokenOut(0);
      }),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [eventBus]);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box>
        {currentModel ? <Text dimColor>{currentModel} </Text> : null}
        <Text dimColor>
          Tokens: {tokenIn}↓ {tokenOut}↑
        </Text>
        {stepCount > 0 && <Text dimColor> Steps: {stepCount}</Text>}
        {isRunning && <Text color="yellow"> Running</Text>}
      </Box>
      <Text dimColor>Ctrl+B: Panels | Ctrl+N: New | Ctrl+C: Abort | /help</Text>
    </Box>
  );
}
