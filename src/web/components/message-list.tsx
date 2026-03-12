// src/web/components/message-list.tsx — Scrollable message list
import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area.js';
import { Button } from './ui/button.js';
import { useChatStore, useRunStore } from '../stores.js';
import type { ChatMessage } from '../../shared/types/ui.js';

interface MessageBubbleProps {
  message: ChatMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-md px-4 py-2.5 text-sm font-sans whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-primary text-white'
            : 'bg-card text-foreground'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function StreamingBubble({ text }: { text: string }) {
  if (!text) return null;

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[85%] md:max-w-[75%] rounded-md px-4 py-2.5 text-sm font-sans whitespace-pre-wrap break-words bg-card text-foreground">
        {text}
        <span className="inline-block w-[2px] h-[1em] bg-foreground ml-0.5 align-middle animate-cursor-blink" />
      </div>
    </div>
  );
}

interface MessageListProps {
  sessionId: string;
}

export function MessageList({ sessionId }: MessageListProps) {
  const messages = useChatStore((s) => s.messages.get(sessionId) ?? []);
  const streamingText = useChatStore((s) => s.streamingText);
  const isRunning = useRunStore((s) => s.isRunning);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const userScrolledUpRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    userScrolledUpRef.current = false;
    setShowScrollFab(false);
  }, []);

  // Auto-scroll on new messages or streaming delta (unless user scrolled up)
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, streamingText]);

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isAtBottom = distanceFromBottom < 50;

    if (isAtBottom) {
      userScrolledUpRef.current = false;
      setShowScrollFab(false);
    } else {
      userScrolledUpRef.current = true;
      setShowScrollFab(true);
    }
  }, []);

  return (
    <div className="relative flex-1 min-h-0">
      <ScrollArea
        ref={scrollRef}
        className="h-full"
        onScroll={handleScroll}
      >
        <div className="max-w-4xl mx-auto px-4 py-4">
          {messages.map((msg, i) => (
            <MessageBubble key={`${msg.timestamp}-${i}`} message={msg} />
          ))}

          {isRunning && streamingText && (
            <StreamingBubble text={streamingText} />
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {showScrollFab && (
        <div className="absolute bottom-4 right-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={scrollToBottom}
            className="rounded-full bg-background-elevated border border-border shadow-lg h-9 w-9"
          >
            <ArrowDown size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
