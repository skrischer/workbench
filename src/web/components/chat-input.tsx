// src/web/components/chat-input.tsx — Chat input with auto-growing textarea
import { useState, useRef, useCallback, type KeyboardEvent, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from './ui/button.js';
import { useRunStore, useSessionStore } from '../stores.js';
import { useWs } from '../providers/ws-provider.js';

export function ChatInput() {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isRunning = useRunStore((s) => s.isRunning);
  const activeId = useSessionStore((s) => s.activeId);
  const { sendCommand } = useWs();

  const resetHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || isRunning || !activeId) return;

      sendCommand('send_message', { sessionId: activeId, prompt: trimmed }).catch(() => {
        // Error handling via WS response — silently ignore here
      });
      setText('');

      // Reset textarea height after clearing
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.style.height = 'auto';
        }
      });
    },
    [text, isRunning, activeId, sendCommand],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const canSend = text.trim().length > 0 && !isRunning && activeId !== null;

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-t border-border-subtle bg-background-deep px-4 py-2"
    >
      <div className="max-w-4xl mx-auto flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            resetHeight();
          }}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder={isRunning ? 'Running...' : 'Type a message...'}
          rows={1}
          className={`flex-1 resize-none rounded-md border border-border px-3 py-2 font-sans text-base text-foreground placeholder:text-foreground-muted
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
            transition-colors duration-fast
            h-[44px] md:h-[40px]
            ${isRunning ? 'bg-muted cursor-not-allowed opacity-50' : 'bg-background-deep'}`}
        />
        <Button
          type="submit"
          variant="primary"
          size="icon"
          disabled={!canSend}
          className="shrink-0 h-[44px] w-[44px] md:h-[40px] md:w-[40px]"
        >
          <Send size={18} />
        </Button>
      </div>
    </form>
  );
}
