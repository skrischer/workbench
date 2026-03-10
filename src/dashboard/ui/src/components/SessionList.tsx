// src/dashboard/ui/src/components/SessionList.tsx — Hierarchical Session List

import { Link } from 'react-router-dom';
import { SessionNode } from '../pages/SessionsPage.js';

interface SessionListProps {
  sessions: SessionNode[];
  depth?: number;
}

/**
 * Render a single session row with indentation based on depth
 */
function SessionRow({ session, depth = 0 }: { session: SessionNode; depth?: number }) {
  const indentClass = depth > 0 ? `ml-${depth * 8}` : '';
  const statusColor = getStatusColor(session.status);

  return (
    <>
      <div className={`border rounded-lg p-4 mb-2 hover:bg-gray-50 ${indentClass}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {depth > 0 && (
                <span className="text-gray-400 text-sm">↳</span>
              )}
              <Link
                to={`/sessions/${session.id}`}
                className="text-blue-600 hover:underline font-mono text-sm"
              >
                {session.id}
              </Link>
              <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
                {session.status}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div>
                <span className="text-gray-500">Agent:</span>{' '}
                <span className="font-medium">{session.agentId}</span>
              </div>
              <div>
                <span className="text-gray-500">Created:</span>{' '}
                <span>{formatDate(session.createdAt)}</span>
              </div>
              {session.parentId && (
                <div>
                  <span className="text-gray-500">Parent:</span>{' '}
                  <Link
                    to={`/sessions/${session.parentId}`}
                    className="text-blue-600 hover:underline font-mono text-xs"
                  >
                    {session.parentId}
                  </Link>
                </div>
              )}
              <div>
                <span className="text-gray-500">Messages:</span>{' '}
                <span>{session.messages.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Render children recursively */}
      {session.children.length > 0 && (
        <div>
          {session.children.map(child => (
            <SessionRow key={child.id} session={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Session List — renders sessions in a hierarchical tree
 */
export function SessionList({ sessions, depth = 0 }: SessionListProps) {
  return (
    <div className="space-y-2">
      {sessions.map(session => (
        <SessionRow key={session.id} session={session} depth={depth} />
      ))}
    </div>
  );
}

/**
 * Get status badge color
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    case 'completed':
      return 'bg-blue-100 text-blue-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Format ISO date string to human-readable format
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // Fallback to date string
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
