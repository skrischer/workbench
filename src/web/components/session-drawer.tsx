// src/web/components/session-drawer.tsx — Mobile Session Drawer
import { useEffect, useCallback } from 'react';

interface SessionDrawerProps {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export function SessionDrawer({ open, onClose, children }: SessionDrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 md:hidden"
      style={{ zIndex: 'var(--z-drawer)' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-[250ms]"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className="absolute top-0 left-0 h-full bg-background-deep border-r border-border-subtle overflow-y-auto animate-slide-in"
        style={{ maxWidth: '85vw', width: '320px' }}
      >
        {children ?? (
          <div className="p-4 text-foreground-muted font-sans text-sm">
            Session panel placeholder
          </div>
        )}
      </div>
    </div>
  );
}
