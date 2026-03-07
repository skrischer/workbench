// src/dashboard/ui/src/pages/RunsPage.tsx — Runs List Page

import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import type { RunMetadata } from '../../../../types/run.js';

/**
 * Get status badge color classes
 */
function getStatusColor(status: RunMetadata['status']): string {
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
 * Calculate run duration in seconds
 */
function getDuration(run: RunMetadata): string {
  if (!run.endedAt) {
    return 'Running...';
  }
  const start = new Date(run.startedAt).getTime();
  const end = new Date(run.endedAt).getTime();
  const durationSec = ((end - start) / 1000).toFixed(1);
  return `${durationSec}s`;
}

/**
 * Format date for display
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Runs list page showing all agent executions
 */
export default function RunsPage() {
  const { data: runs, loading, error, refetch } = useApi<RunMetadata[]>('/runs');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Runs</h1>
            <button
              onClick={refetch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Refresh
            </button>
          </div>
          <Link to="/" className="mt-2 inline-block text-blue-600 hover:text-blue-800 underline text-sm">
            ← Back to Home
          </Link>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading runs...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            <p className="font-semibold">Error loading runs</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && runs && runs.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600">No runs found</p>
          </div>
        )}

        {/* Runs list */}
        {!loading && !error && runs && runs.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Run ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tokens
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/runs/${run.id}`}
                        className="text-blue-600 hover:text-blue-800 font-mono text-sm font-medium"
                      >
                        {run.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(run.status)}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(run.startedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {getDuration(run)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {run.tokenUsage ? (
                        <span className="font-mono">{run.tokenUsage.totalTokens.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
