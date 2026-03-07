// src/dashboard/ui/src/components/MessageList.tsx — Message Timeline Component

import type { RunMessage } from '../../../../types/run.js';

export interface MessageListProps {
  messages: RunMessage[];
  className?: string;
}

/**
 * Get emoji icon for message role
 */
function getRoleIcon(role: RunMessage['role']): string {
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
function getRoleColor(role: RunMessage['role']): string {
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
 * Chronological message timeline with role icons
 */
export function MessageList({ messages, className = '' }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        No messages yet
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {messages.map((message, index) => (
        <div
          key={index}
          className={`border rounded-lg p-4 ${getRoleColor(message.role)}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{getRoleIcon(message.role)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm text-gray-900 capitalize">
                  {message.role}
                </span>
                <span className="text-xs text-gray-500">Step {message.stepIndex + 1}</span>
              </div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                {message.content}
              </div>
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  Tool calls: {message.toolCalls.join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
