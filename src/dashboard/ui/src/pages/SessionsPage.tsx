// src/dashboard/ui/src/pages/SessionsPage.tsx — Sessions List Page

import { useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import { Session } from '../../../../types/index.js';
import { SessionList } from '../components/SessionList.js';
import { NewSessionDialog } from '../components/NewSessionDialog.js';

/** Session with children for tree rendering */
export interface SessionNode extends Session {
  children: SessionNode[];
}

/**
 * Build parent-child tree from flat session list
 */
function buildSessionTree(sessions: Session[] | null): SessionNode[] {
  if (!sessions || sessions.length === 0) return [];

  // Create map of session ID → SessionNode
  const map = new Map<string, SessionNode>(
    sessions.map(s => [s.id, { ...s, children: [] }])
  );

  const roots: SessionNode[] = [];

  // Build tree structure
  sessions.forEach(s => {
    const node = map.get(s.id);
    if (!node) return;

    if (s.parentId && map.has(s.parentId)) {
      // Add to parent's children
      map.get(s.parentId)!.children.push(node);
    } else {
      // No parent or parent not found → root node
      roots.push(node);
    }
  });

  return roots;
}

/**
 * Sessions Page — shows all sessions with parent-child hierarchy
 */
export function SessionsPage() {
  const { data: sessions, loading, error, refetch } = useApi<Session[]>('/sessions');
  const [showNewDialog, setShowNewDialog] = useState(false);

  const sessionTree = buildSessionTree(sessions);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Sessions</h1>
        <p className="text-gray-500">Loading sessions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Sessions</h1>
        <p className="text-red-500">Error: {error}</p>
        <button
          onClick={refetch}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <button
          onClick={() => setShowNewDialog(true)}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
        >
          <span>+</span>
          <span>New Session</span>
        </button>
      </div>

      {sessionTree.length === 0 ? (
        <p className="text-gray-500">No sessions yet. Create one to get started!</p>
      ) : (
        <SessionList sessions={sessionTree} />
      )}

      {showNewDialog && (
        <NewSessionDialog
          onClose={() => setShowNewDialog(false)}
          onCreate={(agentId, initialPrompt) => {
            fetch('/api/sessions/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agentId, initialPrompt }),
            })
              .then(response => {
                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.json();
              })
              .then(() => {
                setShowNewDialog(false);
                refetch();
              })
              .catch(err => {
                console.error('Failed to create session:', err);
                alert(`Failed to create session: ${err.message}`);
              });
          }}
        />
      )}
    </div>
  );
}
