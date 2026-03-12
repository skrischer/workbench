// src/web/components/status-bar.tsx — Status bar with run metrics and abort
import { Square } from 'lucide-react';
import { useRunStore } from '../stores.js';
import { useWs } from '../providers/ws-provider.js';
import { cn } from '../lib/utils.js';

function formatTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface StatusBarProps {
  className?: string;
}

export function StatusBar({ className }: StatusBarProps) {
  const isRunning = useRunStore((s) => s.isRunning);
  const activeRunId = useRunStore((s) => s.activeRunId);
  const model = useRunStore((s) => s.model);
  const tokenUsage = useRunStore((s) => s.tokenUsage);
  const stepCount = useRunStore((s) => s.stepCount);
  const { sendCommand } = useWs();

  const handleAbort = () => {
    if (activeRunId) {
      sendCommand('abort_run', { runId: activeRunId });
    }
  };

  return (
    <div
      className={cn(
        'flex items-center h-8 px-3 border-t border-border-subtle bg-background-deep text-foreground-muted font-mono text-xs shrink-0 gap-3',
        className,
      )}
    >
      {/* Model */}
      {model && (
        <span className="truncate max-w-[120px]" title={model}>
          {model}
        </span>
      )}

      {/* Tokens */}
      <span className="flex items-center gap-1">
        <span className="text-foreground-muted/60">In:</span>
        <span>{formatTokenCount(tokenUsage.input)}</span>
        <span className="text-foreground-muted/60 ml-1">Out:</span>
        <span>{formatTokenCount(tokenUsage.output)}</span>
      </span>

      {/* Steps */}
      <span>
        <span className="text-foreground-muted/60">Steps:</span>{' '}
        {stepCount}
      </span>

      {/* Run Status */}
      <span
        className={cn(
          'flex items-center gap-1',
          isRunning ? 'text-warning' : 'text-foreground-muted',
        )}
      >
        {isRunning ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
            Running
          </>
        ) : (
          'Idle'
        )}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Abort Button */}
      {isRunning && (
        <button
          type="button"
          onClick={handleAbort}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-destructive hover:bg-destructive/10 transition-colors text-xs font-mono"
          aria-label="Abort run"
        >
          <Square size={12} />
          Abort
        </button>
      )}
    </div>
  );
}
