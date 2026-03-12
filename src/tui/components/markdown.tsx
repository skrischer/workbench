// src/tui/components/markdown.tsx — Markdown renderer for terminal output

import React, { useMemo } from 'react';
import { Text } from 'ink';
import { marked } from 'marked';
import markedTerminal from 'marked-terminal';

// Configure marked with terminal renderer extension
marked.use(markedTerminal());

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
