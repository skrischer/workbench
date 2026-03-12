// src/web/components/file-diff-viewer.tsx — Unified diff viewer for file tool results
import { useState, useCallback, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils.js';

// === Types ===

interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

// === Diff Parser ===

function parseDiff(content: string): DiffLine[] | null {
  const lines = content.split('\n');

  // Check if this looks like a unified diff
  const hasDiffMarkers = lines.some(
    (l) =>
      l.startsWith('---') ||
      l.startsWith('+++') ||
      l.startsWith('@@') ||
      l.startsWith('diff --git'),
  );

  if (!hasDiffMarkers) return null;

  const result: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    // Skip diff headers
    if (
      line.startsWith('diff --git') ||
      line.startsWith('---') ||
      line.startsWith('+++') ||
      line.startsWith('index ')
    ) {
      continue;
    }

    // Hunk header
    const hunkMatch = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/.exec(line);
    if (hunkMatch) {
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      continue;
    }

    if (line.startsWith('+')) {
      result.push({
        type: 'added',
        content: line.slice(1),
        newLineNo: newLine++,
      });
    } else if (line.startsWith('-')) {
      result.push({
        type: 'removed',
        content: line.slice(1),
        oldLineNo: oldLine++,
      });
    } else if (line.startsWith(' ') || line === '') {
      result.push({
        type: 'context',
        content: line.startsWith(' ') ? line.slice(1) : line,
        oldLineNo: oldLine++,
        newLineNo: newLine++,
      });
    }
  }

  return result.length > 0 ? result : null;
}

// === Components ===

function DiffCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="p-1 rounded text-foreground-muted hover:text-foreground hover:bg-muted transition-colors"
      aria-label={copied ? 'Copied' : 'Copy diff'}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

const LINE_STYLES = {
  added: 'bg-success/10 text-success',
  removed: 'bg-destructive/10 text-destructive',
  context: 'text-foreground-secondary',
} as const;

interface FileDiffViewerProps {
  content: string;
  className?: string;
}

export function FileDiffViewer({ content, className }: FileDiffViewerProps) {
  const diffLines = useMemo(() => parseDiff(content), [content]);

  // Not a diff — show as raw text
  if (!diffLines) {
    return (
      <pre className={cn(
        'bg-code-background rounded-md p-2.5 text-xs font-mono text-foreground-secondary overflow-x-auto whitespace-pre-wrap break-words',
        className,
      )}>
        {content}
      </pre>
    );
  }

  // Desktop-only diff view (hidden on mobile)
  return (
    <div className={cn('rounded-md overflow-hidden', className)}>
      {/* Mobile: raw output */}
      <pre className="md:hidden bg-code-background rounded-md p-2.5 text-xs font-mono text-foreground-secondary overflow-x-auto whitespace-pre-wrap break-words">
        {content}
      </pre>

      {/* Desktop: diff view */}
      <div className="hidden md:block bg-code-background">
        <div className="flex items-center justify-end px-2 py-1 border-b border-border-subtle">
          <DiffCopyButton text={content} />
        </div>
        <div className="overflow-x-auto text-xs font-mono">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={cn(
                'flex whitespace-pre',
                LINE_STYLES[line.type],
              )}
            >
              <span className="w-10 shrink-0 text-right pr-2 select-none text-foreground-muted/50 border-r border-border-subtle">
                {line.oldLineNo ?? ''}
              </span>
              <span className="w-10 shrink-0 text-right pr-2 select-none text-foreground-muted/50 border-r border-border-subtle">
                {line.newLineNo ?? ''}
              </span>
              <span className="w-5 shrink-0 text-center select-none">
                {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
              </span>
              <span className="flex-1 pr-2">{line.content}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
