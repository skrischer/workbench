// src/tui/components/session-panel.tsx — Session list panel (Gateway client)

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTuiWs } from '../providers/ws-provider.js';
import { theme, statusColors } from '../theme.js';
import type { SessionPreview } from '../types.js';
import type { SessionStatus } from '../../types/index.js';

const STATUS_ICONS: Record<SessionStatus, string> = {
  active: '●',
  completed: '○',
  paused: '⏸',
  failed: '✗',
};

export interface SessionPanelProps {
  isFocused: boolean;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
}

export function SessionPanel({ isFocused, activeSessionId, onSelectSession }: SessionPanelProps): React.ReactElement {
  const { sendCommand, status } = useTuiWs();
  const [sessions, setSessions] = useState<SessionPreview[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Load sessions via Gateway
  const loadSessions = useCallback(async () => {
    if (status !== 'open') return;
    try {
      const result = await sendCommand('list_sessions') as SessionPreview[];
      const previews: SessionPreview[] = result.map((s) => ({
        id: s.id,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        messageCount: s.messageCount,
        promptPreview: s.promptPreview || s.id.slice(0, 8),
      }));
      setSessions(previews);
    } catch {
      // Ignore load errors silently
    }
  }, [sendCommand, status]);

  useEffect(() => {
    void loadSessions();
    const interval = setInterval(() => void loadSessions(), 5000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  // Keyboard navigation
  useInput(
    (input, key) => {
      if (!isFocused) return;

      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(sessions.length - 1, prev + 1));
      } else if (key.return && sessions.length > 0) {
        const session = sessions[selectedIndex];
        if (session) {
          onSelectSession(session.id);
        }
      }
    },
    { isActive: isFocused }
  );

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="single" borderColor={isFocused ? theme.ring : theme.border} paddingX={1} overflow="hidden">
      <Box marginBottom={1}>
        <Text bold color={theme.primary}>Sessions</Text>
      </Box>
      {sessions.length === 0 ? (
        <Text dimColor>No sessions yet</Text>
      ) : (
        sessions.map((session, index) => {
          const isSelected = index === selectedIndex;
          const isActive = session.id === activeSessionId;
          const icon = STATUS_ICONS[session.status];
          const date = new Date(session.createdAt).toLocaleDateString('de-DE', {
            month: '2-digit',
            day: '2-digit',
          });

          return (
            <Box key={session.id}>
              <Text
                color={isActive ? theme.success : statusColors[session.status]}
                inverse={isSelected && isFocused}
              >
                {icon} {date} {session.promptPreview || session.id.slice(0, 8)}
              </Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}
