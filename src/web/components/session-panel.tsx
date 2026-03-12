// src/web/components/session-panel.tsx — Session List Panel (design-system/pages/sessions.md)
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Plus,
  Search,
  X,
  Loader2,
  Check,
  Pause,
  Circle,
} from 'lucide-react';
import { useWs } from '../providers/ws-provider.js';
import { useSessionStore, sessionStore, chatStore } from '../stores.js';
import type { SessionPreview } from '../../shared/types/ui.js';
import type { SessionStatus } from '../../types/index.js';
import type { ChatMessage } from '../../shared/types/ui.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { ScrollArea } from './ui/scroll-area.js';

// === Helpers ===

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// === Status Dot ===

interface StatusDotProps {
  status: SessionStatus;
}

function StatusDot({ status }: StatusDotProps) {
  switch (status) {
    case 'active':
      return (
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <Loader2 size={12} className="relative text-success animate-spin" />
        </span>
      );
    case 'completed':
      return <Check size={12} className="shrink-0 text-success" />;
    case 'paused':
      return <Pause size={12} className="shrink-0 text-warning" />;
    case 'failed':
      return <X size={12} className="shrink-0 text-destructive" />;
    default:
      return <Circle size={12} className="shrink-0 text-foreground-muted" />;
  }
}

// === Session Item ===

interface SessionItemProps {
  session: SessionPreview;
  isActive: boolean;
  onSelect: (id: string) => void;
}

function SessionItem({ session, isActive, onSelect }: SessionItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(session.id)}
      className={`w-full text-left px-3 py-2.5 rounded-md transition-colors min-h-[56px] ${
        isActive
          ? 'bg-primary-glow border-l-2 border-primary'
          : 'hover:bg-muted border-l-2 border-transparent'
      }`}
    >
      {/* Top row: status dot + timestamp */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <StatusDot status={session.status} />
        <span className="text-[11px] font-mono text-foreground-muted leading-none">
          {formatRelativeTime(session.updatedAt)}
        </span>
      </div>

      {/* Prompt preview (truncated 2 lines) */}
      <p className="text-sm font-sans text-foreground-secondary leading-snug line-clamp-2">
        {session.promptPreview || 'New session'}
      </p>

      {/* Metadata row */}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[11px] font-mono text-foreground-muted">
          {session.messageCount} msgs
        </span>
      </div>
    </button>
  );
}

// === Session Panel ===

export function SessionPanel() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const filter = useSessionStore((s) => s.filter);
  const isLoading = useSessionStore((s) => s.isLoading);

  const { sendCommand, status: wsStatus } = useWs();

  const [searchValue, setSearchValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(false);

  // Initial load when WS connects
  useEffect(() => {
    if (wsStatus !== 'open' || initialLoadRef.current) return;
    initialLoadRef.current = true;

    sessionStore.getState().setLoading(true);

    sendCommand('list_sessions')
      .then((data) => {
        const result = data as SessionPreview[];
        sessionStore.getState().setSessions(result);
      })
      .catch(() => {
        // Silently handle — user will see empty list
      })
      .finally(() => {
        sessionStore.getState().setLoading(false);
      });
  }, [wsStatus, sendCommand]);

  // Reset initial load flag if WS reconnects
  useEffect(() => {
    if (wsStatus === 'closed' || wsStatus === 'error') {
      initialLoadRef.current = false;
    }
  }, [wsStatus]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      sessionStore.getState().setFilter(value);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (value.trim()) {
        debounceRef.current = setTimeout(() => {
          sendCommand('search_sessions', { query: value.trim() })
            .then((data) => {
              const result = data as SessionPreview[];
              sessionStore.getState().setSessions(result);
            })
            .catch(() => {
              // Keep current list on error
            });
        }, 300);
      } else {
        // Clear filter: reload full list
        debounceRef.current = setTimeout(() => {
          sendCommand('list_sessions')
            .then((data) => {
              const result = data as SessionPreview[];
              sessionStore.getState().setSessions(result);
            })
            .catch(() => {
              // Keep current list on error
            });
        }, 300);
      }
    },
    [sendCommand],
  );

  const clearSearch = useCallback(() => {
    handleSearchChange('');
  }, [handleSearchChange]);

  // Select session
  const handleSelect = useCallback(
    (id: string) => {
      sessionStore.getState().setActive(id);

      sendCommand('load_session', { id })
        .then((data) => {
          const result = data as { messages: ChatMessage[] };
          chatStore.getState().setMessages(id, result.messages);
        })
        .catch(() => {
          // Silently handle
        });
    },
    [sendCommand],
  );

  // New session
  const handleNewSession = useCallback(() => {
    sendCommand('create_session')
      .then((data) => {
        const newSession = data as SessionPreview;
        sessionStore.getState().addSession(newSession);
        sessionStore.getState().setActive(newSession.id);
      })
      .catch(() => {
        // Silently handle
      });
  }, [sendCommand]);

  // Filter sessions locally
  const filteredSessions = filter
    ? sessions.filter((s) =>
        s.promptPreview.toLowerCase().includes(filter.toLowerCase()),
      )
    : sessions;

  return (
    <div className="flex flex-col h-full">
      {/* Header with New Session button */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <h2 className="text-sm font-mono font-semibold text-foreground">
          Sessions
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNewSession}
          className="h-8 w-8"
          aria-label="New session"
        >
          <Plus size={16} />
        </Button>
      </div>

      {/* Search (sticky) */}
      <div className="sticky top-0 px-3 py-2 border-b border-border-subtle bg-background-deep shrink-0">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none"
          />
          <Input
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search sessions..."
            className="pl-8 pr-8 h-8 text-sm bg-background border-border"
          />
          {searchValue && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Session List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {isLoading && filteredSessions.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="text-foreground-muted animate-spin" />
            </div>
          )}

          {!isLoading && filteredSessions.length === 0 && (
            <p className="text-center text-sm font-sans text-foreground-muted py-8">
              {filter ? 'No sessions found' : 'No sessions yet'}
            </p>
          )}

          {filteredSessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={session.id === activeId}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
