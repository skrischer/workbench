// src/dashboard/ui/src/components/ChatInput.tsx — Chat Input Component

import { useState, type FormEvent, type KeyboardEvent } from 'react';

export interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Chat input field with send button
 * 
 * Features:
 * - Auto-focus on mount
 * - Enter to send (Shift+Enter for new line)
 * - Loading state during send
 * - Auto-clear on successful send
 */
export function ChatInput({ 
  onSend, 
  disabled = false,
  placeholder = 'Type your message...' 
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    const trimmed = input.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setInput(''); // Clear on success
    } catch (err) {
      console.error('Failed to send message:', err);
      // Keep input on error so user can retry
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send (Shift+Enter for new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || sending}
          autoFocus
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          style={{ minHeight: '40px', maxHeight: '120px' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || disabled || sending}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        Press <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded">Shift+Enter</kbd> for new line
      </div>
    </form>
  );
}
