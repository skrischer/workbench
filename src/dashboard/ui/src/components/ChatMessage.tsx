// src/dashboard/ui/src/components/ChatMessage.tsx — Chat Message Component

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message, ToolUseBlock } from '../../../../types/index.js';

export interface ChatMessageProps {
  message: Message;
  className?: string;
}

/**
 * Get emoji icon for message role
 */
function getRoleIcon(role: Message['role']): string {
  switch (role) {
    case 'user':
      return '👤';
    case 'assistant':
      return '🤖';
    case 'system':
      return '⚙️';
    case 'tool':
      return '🔧';
    default:
      return '💬';
  }
}

/**
 * Get color classes for message role
 */
function getRoleColor(role: Message['role']): string {
  switch (role) {
    case 'user':
      return 'bg-blue-50 border-blue-200';
    case 'assistant':
      return 'bg-green-50 border-green-200';
    case 'system':
      return 'bg-gray-50 border-gray-200';
    case 'tool':
      return 'bg-purple-50 border-purple-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
}

/**
 * Collapsible tool call card
 */
function ToolCallCard({ toolUse }: { toolUse: ToolUseBlock }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔧</span>
          <div>
            <div className="font-medium text-sm text-gray-900">{toolUse.name}</div>
            <div className="text-xs text-gray-500">Tool Call</div>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-100">
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Input:</div>
            <pre className="text-xs bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
              <code>{JSON.stringify(toolUse.input, null, 2)}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Chat message with role styling, markdown rendering, and tool call cards
 */
export function ChatMessage({ message, className = '' }: ChatMessageProps) {
  const hasToolUses = message.toolUses && message.toolUses.length > 0;

  return (
    <div
      className={`border rounded-lg p-4 ${getRoleColor(message.role)} ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{getRoleIcon(message.role)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-sm text-gray-900 capitalize">
              {message.role}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
          
          {/* Message content with markdown for assistant messages */}
          <div className="text-sm text-gray-800">
            {message.role === 'assistant' ? (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    // Customize markdown rendering
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    code: ({ inline, children, ...props }: any) =>
                      inline ? (
                        <code className="px-1 py-0.5 bg-gray-100 rounded text-xs" {...props}>
                          {children}
                        </code>
                      ) : (
                        <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
                          <code {...props}>{children}</code>
                        </pre>
                      ),
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            )}
          </div>

          {/* Tool call cards */}
          {hasToolUses && (
            <div className="space-y-2">
              {message.toolUses!.map((toolUse) => (
                <ToolCallCard key={toolUse.id} toolUse={toolUse} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
