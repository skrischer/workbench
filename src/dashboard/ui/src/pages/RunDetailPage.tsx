// src/dashboard/ui/src/pages/RunDetailPage.tsx — Run Detail Page with Live Updates

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { MessageList } from '../components/MessageList.js';
import { ToolCallCard } from '../components/ToolCallCard.js';
import { TokenBadge } from '../components/TokenBadge.js';
import type { RunLog, RunMessage, RunToolCall } from '../../../../types/run.js';
import type { EventMap } from '../../../../types/events.js';

/**
 * Get status badge color classes
 */
function getStatusColor(status: RunLog['metadata']['status']): string {
  switch (status) {
    case 'running':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'failed':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
}

/**
 * Run detail page with chronological message timeline and live updates
 */
export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: initialRun, loading, error } = useApi<RunLog>(`/runs/${id}`);
  const { connected, subscribe } = useWebSocket();

  // Local state for live updates
  const [run, setRun] = useState<RunLog | null>(null);

  // Initialize from API data
  useEffect(() => {
    if (initialRun) {
      setRun(initialRun);
    }
  }, [initialRun]);

  // Subscribe to live updates
  useEffect(() => {
    if (!id) return;

    const unsubscribe = subscribe('run:*', (payload) => {
      // Type-safe event handling
      const event = payload as EventMap[keyof EventMap];

      // Check if this event is for the current run
      if ('runId' in event && event.runId !== id) {
        return;
      }

      // Update run state based on event type
      setRun((prev) => {
        if (!prev) return prev;

        // Handle run:step - add new message
        if ('stepIndex' in event && 'message' in event) {
          const stepEvent = event as EventMap['run:step'];
          const newMessage: RunMessage = {
            role: stepEvent.message.role,
            content: stepEvent.message.content,
            stepIndex: stepEvent.stepIndex,
          };
          return {
            ...prev,
            messages: [...prev.messages, newMessage],
          };
        }

        // Handle tool:result - add tool call
        if ('toolName' in event && 'result' in event && 'durationMs' in event) {
          const toolEvent = event as EventMap['tool:result'];
          const newToolCall: RunToolCall = {
            toolName: toolEvent.toolName,
            input: {},
            output: JSON.stringify(toolEvent.result),
            durationMs: toolEvent.durationMs,
            stepIndex: prev.toolCalls.length,
          };
          return {
            ...prev,
            toolCalls: [...prev.toolCalls, newToolCall],
          };
        }

        // Handle run:end - update metadata
        if ('result' in event && 'tokenUsage' in event) {
          const endEvent = event as EventMap['run:end'];
          return {
            ...prev,
            metadata: {
              ...prev.metadata,
              status: 'completed',
              tokenUsage: endEvent.tokenUsage,
              endedAt: new Date().toISOString(),
            },
          };
        }

        // Handle run:error
        if ('error' in event) {
          return {
            ...prev,
            metadata: {
              ...prev.metadata,
              status: 'failed',
              endedAt: new Date().toISOString(),
            },
          };
        }

        return prev;
      });
    });

    return unsubscribe;
  }, [id, subscribe]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading run...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            <p className="font-semibold">Error loading run</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <Link to="/runs" className="mt-4 inline-block text-blue-600 hover:text-blue-800 underline">
            ← Back to Runs
          </Link>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-gray-600">Run not found</p>
          <Link to="/runs" className="mt-4 inline-block text-blue-600 hover:text-blue-800 underline">
            ← Back to Runs
          </Link>
        </div>
      </div>
    );
  }

  const { metadata, messages, toolCalls } = run;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link to="/runs" className="inline-block text-blue-600 hover:text-blue-800 underline text-sm mb-2">
            ← Back to Runs
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 font-mono">{metadata.id}</h1>
              <p className="text-sm text-gray-600 mt-1">{metadata.prompt}</p>
            </div>
            <div className="flex items-center gap-3">
              {connected && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full border border-green-300">
                  ● Live
                </span>
              )}
              <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${getStatusColor(metadata.status)}`}>
                {metadata.status}
              </span>
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Started</div>
              <div className="text-sm font-medium text-gray-900">
                {new Date(metadata.startedAt).toLocaleString()}
              </div>
            </div>
            {metadata.endedAt && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Ended</div>
                <div className="text-sm font-medium text-gray-900">
                  {new Date(metadata.endedAt).toLocaleString()}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500 mb-1">Messages</div>
              <div className="text-sm font-medium text-gray-900">{messages.length}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Tool Calls</div>
              <div className="text-sm font-medium text-gray-900">{toolCalls.length}</div>
            </div>
          </div>
          {metadata.tokenUsage && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-2">Token Usage</div>
              <TokenBadge usage={metadata.tokenUsage} />
            </div>
          )}
        </div>

        {/* Messages Timeline */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Messages</h2>
          <MessageList messages={messages} />
        </div>

        {/* Tool Calls */}
        {toolCalls.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Tool Calls</h2>
            <div className="space-y-3">
              {toolCalls.map((toolCall, index) => (
                <ToolCallCard key={index} toolCall={toolCall} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
