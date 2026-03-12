import * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface TooltipProps {
  content: string;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <div className="group relative inline-flex">
      {children}
      <div
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 hidden group-hover:block',
          'rounded-md bg-card px-2 py-1 text-xs font-sans text-foreground-secondary',
          'border border-border-subtle shadow-lg',
          'whitespace-nowrap',
          {
            'bottom-full left-1/2 -translate-x-1/2 mb-2': side === 'top',
            'top-full left-1/2 -translate-x-1/2 mt-2': side === 'bottom',
            'right-full top-1/2 -translate-y-1/2 mr-2': side === 'left',
            'left-full top-1/2 -translate-y-1/2 ml-2': side === 'right',
          }
        )}
      >
        {content}
      </div>
    </div>
  );
}
