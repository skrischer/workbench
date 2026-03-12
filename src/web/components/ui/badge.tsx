import * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'destructive' | 'warning' | 'info';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-mono font-medium',
        {
          'bg-muted text-foreground-secondary': variant === 'default',
          'bg-success/15 text-success': variant === 'success',
          'bg-destructive/15 text-destructive': variant === 'destructive',
          'bg-warning/15 text-warning': variant === 'warning',
          'bg-info/15 text-info': variant === 'info',
        },
        className
      )}
      {...props}
    />
  );
}
