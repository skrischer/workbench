// src/web/components/message-list.tsx — Scrollable message list with markdown + tool blocks
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ArrowDown } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area.js';
import { Button } from './ui/button.js';
import { MarkdownRenderer } from './markdown-renderer.js';
import { ToolCallBlock } from './tool-call-block.js';
import { useChatStore, useRunStore } from '../stores.js';
import type { ChatMessage, ToolCallState } from '../../shared/types/ui.js';

// === Message Bubbles ===

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[85%] md:max-w-[75%] rounded-md px-4 py-2.5 text-sm font-sans whitespace-pre-wrap break-words bg-primary text-white">
        {message.content}
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[85%] md:max-w-[75%] rounded-md px-4 py-2.5 bg-card text-foreground">
        <MarkdownRenderer content={message.content} />
      </div>
    </div>
  );
}

function StreamingBubble({ text }: { text: string }) {
  if (!text) return null;

  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[85%] md:max-w-[75%] rounded-md px-4 py-2.5 bg-card text-foreground">
        <MarkdownRenderer content={text} isStreaming />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return <UserBubble message={message} />;
  }
  return <AssistantBubble message={message} />;
}

// === Streaming Tool Calls ===

function StreamingToolCalls({ toolCalls }: { toolCalls: Map<string, ToolCallState> }) {
  const entries = useMemo(() => Array.from(toolCalls.values()), [toolCalls]);
  if (entries.length === 0) return null;

  return (
    <div className="mb-3 max-w-[85%] md:max-w-[75%]">
      {entries.map((tc) => (
        <ToolCallBlock key={tc.toolId} toolCall={tc} />
      ))}
    </div>
  );
}

// === Inline Tool Calls from Message History ===

function InlineToolCallBlock({ message }: { message: ChatMessage }) {
  if (message.role !== 'tool' || !message.toolName) return null;

  const toolCall: ToolCallState = {
    toolId: message.toolCallId ?? '',
    toolName: message.toolName,
    input: message.toolInput ? JSON.stringify(message.toolInput) : '',
    result: message.content,
    status: 'success',
  };

  return (
    <div className="mb-3 max-w-[85%] md:max-w-[75%]">
      <ToolCallBlock toolCall={toolCall} />
    </div>
  );
}

// === Message List ===

const EMPTY_MESSAGES: ChatMessage[] = [];

interface MessageListProps {
  sessionId: string;
}

export function MessageList({ sessionId }: MessageListProps) {
  const messages = useChatStore((s) => s.messages.get(sessionId) ?? EMPTY_MESSAGES);
  const streamingText = useChatStore((s) => s.streamingText);
  const streamingToolCalls = useChatStore((s) => s.streamingToolCalls);
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
          {messages.map((msg, i) =>
            msg.role === 'tool' ? (
              <InlineToolCallBlock
                key={`${msg.timestamp}-${i}`}
                message={msg}
              />
            ) : (
              <MessageBubble key={`${msg.timestamp}-${i}`} message={msg} />
            ),
          )}

          {/* Streaming tool calls (active) */}
          {isRunning && streamingToolCalls.size > 0 && (
            <StreamingToolCalls toolCalls={streamingToolCalls} />
          )}

          {/* Streaming text */}
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
