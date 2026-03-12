// src/tui/theme.ts — TUI Design System tokens (mapped from design-system/MASTER.md)

import type { SessionStatus } from '../types/index.js';

/**
 * Semantic color tokens for TUI components.
 * Ink supports hex colors in terminals with truecolor support,
 * with graceful fallback to closest ANSI color.
 */
export const theme = {
  // Backgrounds (used for borderColor on Ink Box components)
  background: '#0F172A',
  backgroundDeep: '#020617',
  backgroundElevated: '#1E293B',

  // Surfaces
  card: '#1B2336',
  muted: '#272F42',
  mutedForeground: '#94A3B8',

  // Primary accent
  primary: '#3B82F6',
  primaryHover: '#2563EB',

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  destructive: '#EF4444',
  info: '#06B6D4',

  // Text
  foreground: '#F8FAFC',
  foregroundSecondary: '#CBD5E1',
  foregroundMuted: '#94A3B8',

  // Borders
  border: '#334155',
  borderSubtle: '#1E293B',
  ring: '#3B82F6',

  // Terminal-specific
  terminalGreen: '#22C55E',
  codeBackground: '#0D1117',
  cursor: '#06B6D4',
} as const;

/** Status colors for session states */
export const statusColors: Record<SessionStatus, string> = {
  active: theme.success,
  completed: theme.foregroundMuted,
  paused: theme.warning,
  failed: theme.destructive,
};

/** Role colors for chat messages */
export const roleColors: Record<'user' | 'assistant' | 'tool', string> = {
  user: theme.primary,
  assistant: theme.foreground,
  tool: theme.foregroundMuted,
};
