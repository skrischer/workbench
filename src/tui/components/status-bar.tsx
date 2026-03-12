// src/tui/components/status-bar.tsx — Bottom status bar with usage bars

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import type { TypedEventBus } from '../../events/event-bus.js';
import type { RateLimitInfo } from '../../types/events.js';
import { getContextWindowSize } from '../../config/index.js';

export interface StatusBarProps {
  eventBus: TypedEventBus;
  isRunning: boolean;
  model?: string;
}

/** Shorten full model ID to display name: "claude-sonnet-4-20250514" → "sonnet-4" */
export function shortModelName(model: string): string {
  // Strip "claude-" prefix
  let name = model.replace(/^claude-/, '');
  // Strip date suffix (-YYYYMMDD)
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

/** Format reset timestamp to human-readable relative/absolute time */
export function formatResetTime(resetUnix: number): string {
  if (resetUnix === 0) return '';
  const now = Math.floor(Date.now() / 1000);
  const diffSec = resetUnix - now;

  if (diffSec <= 0) return 'now';

  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  // Under 2 hours: show relative "~Xh" or "~Xm"
  if (diffHour < 2) {
    if (diffMin < 60) return `~${diffMin}m`;
    const remainMin = diffMin % 60;
    return remainMin > 0 ? `~${diffHour}h${remainMin}m` : `~${diffHour}h`;
  }

  // Over 2 hours: show weekday + time (e.g. "Mo 08:00")
  const resetDate = new Date(resetUnix * 1000);
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const day = days[resetDate.getDay()];
  const hours = String(resetDate.getHours()).padStart(2, '0');
  const mins = String(resetDate.getMinutes()).padStart(2, '0');
  return `${day} ${hours}:${mins}`;
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

export function StatusBar({ eventBus, isRunning, model }: StatusBarProps): React.ReactElement {
  const [latestInputTokens, setLatestInputTokens] = useState(0);
  const [currentModel, setCurrentModel] = useState(model ?? '');
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  useEffect(() => {
    const unsubs = [
      eventBus.on('llm:response', ({ model: m, tokenUsage, rateLimit: rl }) => {
        setCurrentModel(m);
        // Use latest (not cumulative) input tokens — reflects current context size
        setLatestInputTokens(tokenUsage.inputTokens);
        if (rl) {
          setRateLimit(rl);
        }
      }),
      eventBus.on('run:start', () => {
        setLatestInputTokens(0);
      }),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [eventBus]);

  const resolvedModel = currentModel || model || '';
  const displayModel = resolvedModel ? shortModelName(resolvedModel) : '';
  const contextMax = resolvedModel ? getContextWindowSize(resolvedModel) : undefined;
  const contextRatio = contextMax ? latestInputTokens / contextMax : 0;

  const fiveHourPct = rateLimit ? Math.round(rateLimit.fiveHourUtilization * 100) : 0;
  const sevenDayPct = rateLimit ? Math.round(rateLimit.sevenDayUtilization * 100) : 0;

  return (
    <Box borderStyle="single" borderColor={theme.border} paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        {displayModel ? <Text bold color={theme.foregroundSecondary}>{displayModel}</Text> : null}
        {displayModel ? <Text dimColor>│</Text> : null}

        {/* Context window bar */}
        {contextMax ? (
          <>
            <Text dimColor>ctx </Text>
            <UsageBar ratio={contextRatio} />
            <Text dimColor> {formatTokenCount(latestInputTokens)}/{formatTokenCount(contextMax)}</Text>
          </>
        ) : (
          latestInputTokens > 0 && <Text dimColor>ctx {formatTokenCount(latestInputTokens)}</Text>
        )}

        {/* Rate limit bars */}
        {rateLimit ? (
          <>
            <Text dimColor> │ 5h </Text>
            <UsageBar ratio={rateLimit.fiveHourUtilization} />
            <Text dimColor> {fiveHourPct}%</Text>
            {rateLimit.fiveHourReset > 0 && (
              <Text dimColor> {formatResetTime(rateLimit.fiveHourReset)}</Text>
            )}
            <Text dimColor> │ 7d </Text>
            <UsageBar ratio={rateLimit.sevenDayUtilization} />
            <Text dimColor> {sevenDayPct}%</Text>
            {rateLimit.sevenDayReset > 0 && (
              <Text dimColor> {formatResetTime(rateLimit.sevenDayReset)}</Text>
            )}
          </>
        ) : null}

        {isRunning && <Text color={theme.warning}> Running</Text>}
      </Box>
      <Text dimColor>Ctrl+B: Panels | Ctrl+N: New | Ctrl+C: Abort | /help</Text>
    </Box>
  );
}
