import * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-sans font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          'rounded-md',
          {
            'bg-primary text-white hover:bg-primary-hover': variant === 'primary',
            'bg-muted text-foreground hover:bg-background-elevated': variant === 'secondary',
            'hover:bg-muted text-foreground-secondary hover:text-foreground': variant === 'ghost',
            'bg-destructive text-white hover:bg-destructive/90': variant === 'destructive',
            'border border-border bg-transparent text-foreground hover:bg-muted': variant === 'outline',
          },
          {
            'h-8 px-3 text-xs': size === 'sm',
            'h-10 px-4 text-sm': size === 'md',
            'h-11 px-6 text-base': size === 'lg',
            'h-10 w-10 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
