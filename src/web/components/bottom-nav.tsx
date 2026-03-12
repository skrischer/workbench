// src/web/components/bottom-nav.tsx — Mobile Bottom Navigation (MASTER.md §5.8)
import { MessageSquare, List, Settings } from 'lucide-react';
import type { UIState } from '../../shared/stores/ui-store.js';

type ActiveView = UIState['activeView'];

interface BottomNavProps {
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
}

interface NavItem {
  view: ActiveView;
  label: string;
  icon: typeof MessageSquare;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'chat', label: 'Chat', icon: MessageSquare },
  { view: 'sessions', label: 'Sessions', icon: List },
  { view: 'settings', label: 'Settings', icon: Settings },
];

export function BottomNav({ activeView, onViewChange }: BottomNavProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-background-deep border-t border-border-subtle"
      style={{
        height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 'var(--z-sticky)',
      }}
    >
      <div className="flex items-center justify-around h-[56px]">
        {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
          const isActive = activeView === view;
          return (
            <button
              key={view}
              type="button"
              onClick={() => onViewChange(view)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[48px] transition-colors ${
                isActive ? 'text-primary' : 'text-foreground-muted'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-sans leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
