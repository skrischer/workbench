// src/dashboard/ui/src/components/NewSessionDialog.tsx — Dialog for Creating New Sessions

import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi.js';
import { Agent } from '../../../../types/index.js';

interface NewSessionDialogProps {
  onClose: () => void;
  onCreate: (agentId: string, initialPrompt?: string) => void;
}

/**
 * Dialog for creating a new session
 * - Select agent from dropdown
 * - Optional initial prompt
 * - Cancel or Create
 */
export function NewSessionDialog({ onClose, onCreate }: NewSessionDialogProps) {
  const { data: agents, loading, error } = useApi<Agent[]>('/agents');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Auto-select first agent when loaded
  useEffect(() => {
    if (agents && agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgentId) {
      alert('Please select an agent');
      return;
    }
    onCreate(selectedAgentId, prompt.trim() || undefined);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        ref={dialogRef}
        className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
      >
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Create New Session</h2>

          {loading && (
            <p className="text-gray-500 mb-4">Loading agents...</p>
          )}

          {error && (
            <p className="text-red-500 mb-4">Error loading agents: {error}</p>
          )}

          {!loading && !error && agents && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="agent-select"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Agent <span className="text-red-500">*</span>
                </label>
                <select
                  id="agent-select"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {agents.length === 0 && (
                    <option value="">No agents available</option>
                  )}
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name || agent.id} ({agent.model})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="prompt-input"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Initial Prompt <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="prompt-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter an optional initial message for the agent..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedAgentId || agents.length === 0}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Create Session
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
