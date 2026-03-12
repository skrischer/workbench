// src/tui/components/markdown.tsx — Markdown renderer for terminal output

import React, { useMemo } from 'react';
import { Text } from 'ink';
import { marked } from 'marked';

// Lazy-init: marked-terminal crashes at module scope in test environments
let markedConfigured = false;
function ensureMarkedConfigured(): void {
  if (markedConfigured) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const markedTerminal = require('marked-terminal');
    const renderer = markedTerminal.default ?? markedTerminal;
    marked.use(renderer());
  } catch {
    // Fallback: no terminal rendering in test/CI environments
  }
  markedConfigured = true;
}

export interface MarkdownProps {
  children: string;
}

/**
 * Render markdown text for the terminal using marked + marked-terminal.
 * Handles incomplete markdown gracefully during streaming.
 */
export function Markdown({ children }: MarkdownProps): React.ReactElement {
  const rendered = useMemo(() => {
    if (!children) return '';
    ensureMarkedConfigured();
    try {
      // marked.parse returns string synchronously with our config
      const result = marked.parse(children);
      // Strip trailing newlines for cleaner display
      return (typeof result === 'string' ? result : '').replace(/\n+$/, '');
    } catch {
      // Fallback to plain text on parse errors (e.g., incomplete markdown during streaming)
      return children;
    }
  }, [children]);

  return <Text>{rendered}</Text>;
}
