// src/web/components/tool-call-block.tsx — Collapsible tool call display
import { Loader2, Check, X, ChevronRight } from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from './ui/collapsible.js';
import { cn } from '../lib/utils.js';
import type { ToolCallState } from '../../shared/types/ui.js';
import { FileDiffViewer } from './file-diff-viewer.js';

// === Status Helpers ===

const STATUS_STYLES = {
  running: {
    border: 'border-l-warning',
    icon: <Loader2 size={14} className="animate-spin text-warning" />,
    label: 'Running',
  },
  success: {
    border: 'border-l-success',
    icon: <Check size={14} className="text-success" />,
    label: 'Done',
  },
  error: {
    border: 'border-l-destructive',
    icon: <X size={14} className="text-destructive" />,
    label: 'Error',
  },
} as const;

const FILE_TOOLS = new Set(['write_file', 'edit_file']);

function isFileToolResult(toolName: string): boolean {
  return FILE_TOOLS.has(toolName);
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function tryFormatJson(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

// === Component ===

interface ToolCallBlockProps {
  toolCall: ToolCallState;
  className?: string;
}

export function ToolCallBlock({ toolCall, className }: ToolCallBlockProps) {
  const { toolName, input, result, status, durationMs } = toolCall;
  const styles = STATUS_STYLES[status];
  const duration = formatDuration(durationMs);
  const showDiffViewer =
    isFileToolResult(toolName) && result && status === 'success';

  return (
    <Collapsible
      className={cn(
        'border-l-2 rounded-md my-2 bg-background-elevated',
        styles.border,
        className,
      )}
    >
      <CollapsibleTrigger className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-muted transition-colors rounded-r-md group">
        <ChevronRight
          size={14}
          className="text-foreground-muted transition-transform group-[[data-state=open]_&]:rotate-90"
        />
        {styles.icon}
        <span className="font-mono text-xs text-foreground-secondary truncate">
          {toolName}
        </span>
        {duration && (
          <span className="text-[11px] font-mono text-foreground-muted ml-auto shrink-0">
            {duration}
          </span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-3">
        {/* Input */}
        {input && (
          <div className="mt-2">
            <div className="text-[11px] font-mono text-foreground-muted mb-1 uppercase tracking-wider">
              Input
            </div>
            <pre className="bg-code-background rounded-md p-2.5 text-xs font-mono text-foreground-secondary overflow-x-auto whitespace-pre-wrap break-words">
              {tryFormatJson(input)}
            </pre>
          </div>
        )}

        {/* Output */}
        {result !== undefined && (
          <div className="mt-2">
            <div className="text-[11px] font-mono text-foreground-muted mb-1 uppercase tracking-wider">
              Output
            </div>
            {showDiffViewer ? (
              <FileDiffViewer content={result} />
            ) : (
              <pre className="bg-code-background rounded-md p-2.5 text-xs font-mono text-foreground-secondary overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {result}
              </pre>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
