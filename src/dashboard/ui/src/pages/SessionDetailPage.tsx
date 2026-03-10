// src/dashboard/ui/src/pages/SessionDetailPage.tsx — Session Detail Page with Chat Interface

import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { ChatMessage } from '../components/ChatMessage.js';
import { ChatInput } from '../components/ChatInput.js';
import type { Session, Message } from '../../../../types/index.js';
import type { EventMap } from '../../../../types/events.js';

/**
 * Get status badge color classes
 */
function getStatusColor(status: Session['status']): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'completed':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Session detail page with chat interface and live updates
 * 
 * Features:
 * - Chronological message display
 * - Input field for new messages
 * - WebSocket live updates for new messages
 * - Optimistic UI updates
 * - Auto-scroll to bottom
 */
export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, loading, error, refetch } = useApi<Session>(`/api/sessions/${id}`);
  const { connected, subscribe } = useWebSocket();

  // Local state for messages (optimistic updates + live updates)
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize from API data
  useEffect(() => {
    if (session?.messages) {
      setLocalMessages(session.messages);
    }
  }, [session]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  // Subscribe to live message updates via WebSocket
  useEffect(() => {
    if (!id) return;

    // Subscribe to run:step events for this session's runs
    const unsubscribe = subscribe('run:step', (payload) => {
      const event = payload as EventMap['run:step'];
      
      // Check if this run belongs to the current session (we'd need runId -> sessionId mapping)
      // For now, we'll add all messages and let the API filter
      setLocalMessages((prev) => {
        // Avoid duplicates by checking if message already exists
        const exists = prev.some(
          (msg) => msg.timestamp === event.message.timestamp && msg.content === event.message.content
        );
        if (exists) return prev;
        
        return [...prev, event.message];
      });
    });

    return unsubscribe;
  }, [id, subscribe]);

  /**
   * Send new message to the session
   */
  const sendMessage = async (text: string) => {
    if (!id) return;

    // Optimistic update - add user message immediately
    const optimisticMessage: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, optimisticMessage]);

    try {
      // Send message to backend
      const response = await fetch(`/api/sessions/${id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      // Refetch session to get updated state
      refetch();
    } catch (err) {
      console.error('Failed to send message:', err);
      // Remove optimistic message on error
      setLocalMessages((prev) => prev.filter((msg) => msg !== optimisticMessage));
      throw err; // Re-throw so ChatInput can handle it
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Session not found</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/sessions"
              className="text-blue-600 hover:text-blue-700 transition-colors"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Session {session.id}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-gray-600">Agent: {session.agentId}</span>
                {session.parentId && (
                  <span className="text-sm text-gray-600">
                    Parent: <Link to={`/sessions/${session.parentId}`} className="text-blue-600 hover:underline">{session.parentId}</Link>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(
                session.status
              )}`}
            >
              {session.status}
            </span>
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-gray-300'
              }`}
              title={connected ? 'Connected' : 'Disconnected'}
            />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {localMessages.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No messages yet. Start the conversation below!
          </div>
        ) : (
          <div className="space-y-3 max-w-4xl mx-auto">
            {localMessages.map((msg, index) => (
              <ChatMessage key={`${msg.timestamp}-${index}`} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="max-w-4xl mx-auto w-full">
        <ChatInput
          onSend={sendMessage}
          disabled={session.status !== 'active'}
          placeholder={
            session.status === 'active'
              ? 'Type your message...'
              : `Session is ${session.status}. Cannot send messages.`
          }
        />
      </div>

      {/* Footer info */}
      <div className="bg-white border-t border-gray-200 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500 max-w-4xl mx-auto">
          <span>Created: {new Date(session.createdAt).toLocaleString()}</span>
          <span>Updated: {new Date(session.updatedAt).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
