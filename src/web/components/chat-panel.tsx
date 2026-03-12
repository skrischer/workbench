// src/web/components/chat-panel.tsx — Chat container with message list and input
import { MessageList } from './message-list.js';
import { ChatInput } from './chat-input.js';
import { useSessionStore } from '../stores.js';

export function ChatPanel() {
  const activeId = useSessionStore((s) => s.activeId);

  if (!activeId) {
    return (
      <div className="flex-1 flex items-center justify-center text-foreground-muted font-sans text-sm">
        <p>
          Select a session or press{' '}
          <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-foreground-secondary border border-border">
            Ctrl+N
          </kbd>{' '}
          to start a new one
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <MessageList sessionId={activeId} />
      <ChatInput />
    </div>
  );
}
