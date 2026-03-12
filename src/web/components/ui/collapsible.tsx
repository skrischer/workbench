import * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function Collapsible({ open: controlledOpen, onOpenChange, children, className }: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlledOpen ?? internalOpen;

  const toggle = React.useCallback(() => {
    const next = !isOpen;
    setInternalOpen(next);
    onOpenChange?.(next);
  }, [isOpen, onOpenChange]);

  return (
    <div className={cn(className)} data-state={isOpen ? 'open' : 'closed'}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === CollapsibleTrigger) {
            return React.cloneElement(child as React.ReactElement<CollapsibleTriggerProps>, { onClick: toggle });
          }
          if (child.type === CollapsibleContent) {
            return isOpen ? child : null;
          }
        }
        return child;
      })}
    </div>
  );
}

interface CollapsibleTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  onClick?: () => void;
}

export function CollapsibleTrigger({ onClick, children, className, ...props }: CollapsibleTriggerProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn('cursor-pointer', className)}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CollapsibleContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  );
}
