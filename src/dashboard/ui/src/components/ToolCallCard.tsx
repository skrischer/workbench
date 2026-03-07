// src/dashboard/ui/src/components/ToolCallCard.tsx — Expandable Tool Call Card

import { useState } from 'react';
import type { RunToolCall } from '../../../../types/run.js';

export interface ToolCallCardProps {
  toolCall: RunToolCall;
  className?: string;
}

/**
 * Expandable card showing tool call details with formatted JSON input/output
 */
export function ToolCallCard({ toolCall, className = '' }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const durationSec = (toolCall.durationMs / 1000).toFixed(2);

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden bg-white ${className}`}>
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔧</span>
          <div>
            <div className="font-medium text-gray-900">{toolCall.toolName}</div>
            <div className="text-xs text-gray-500">Step {toolCall.stepIndex + 1} • {durationSec}s</div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          {/* Input */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Input:</div>
            <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">
              <code>{JSON.stringify(toolCall.input, null, 2)}</code>
            </pre>
          </div>

          {/* Output */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Output:</div>
            <pre className="text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-x-auto">
              <code>{toolCall.output}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
