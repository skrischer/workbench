// src/dashboard/ui/src/components/TokenBadge.tsx — Token Usage Display

import type { TokenUsage } from '../../../../types/events.js';

export interface TokenBadgeProps {
  usage: TokenUsage;
  className?: string;
}

/**
 * Compact badge showing token usage (input/output/total)
 */
export function TokenBadge({ usage, className = '' }: TokenBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-2 text-xs ${className}`}>
      <span className="text-gray-600">
        <span className="font-medium text-blue-600">{usage.inputTokens.toLocaleString()}</span>
        <span className="text-gray-400 mx-1">→</span>
        <span className="font-medium text-green-600">{usage.outputTokens.toLocaleString()}</span>
      </span>
      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">
        {usage.totalTokens.toLocaleString()} tokens
      </span>
    </div>
  );
}
