// src/dashboard/ui/src/pages/PlanDetailPage.tsx — Plan Detail Page with Step Timeline

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { StepProgress } from '../components/StepProgress.js';
import type { Plan, Step, StepStatus } from '../../../../types/task.js';

/**
 * Status icon component
 */
function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return (
        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    case 'running':
      return (
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      );
    case 'failed':
      return (
        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      );
    case 'skipped':
      return (
        <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center">
          <span className="text-white text-xs font-bold">⊘</span>
        </div>
      );
    case 'pending':
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
        </div>
      );
  }
}

/**
 * Expandable step component
 */
function StepCard({ step, isLast }: { step: Step; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-12 bottom-0 w-0.5 bg-gray-300" />
      )}

      {/* Step card */}
      <div className="relative bg-white rounded-lg shadow p-6 ml-12">
        {/* Status icon (positioned absolutely to overlap timeline) */}
        <div className="absolute -left-16 top-6">
          <StatusIcon status={step.status} />
        </div>

        {/* Step header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left flex items-start justify-between gap-4 hover:opacity-80 transition-opacity"
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                  step.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : step.status === 'running'
                    ? 'bg-blue-100 text-blue-800'
                    : step.status === 'failed'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {step.status}
              </span>
              {step.result?.durationMs && (
                <span>{(step.result.durationMs / 1000).toFixed(2)}s</span>
              )}
            </div>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Prompt */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1">Prompt</h4>
              <pre className="bg-gray-50 rounded p-3 text-xs font-mono text-gray-800 overflow-x-auto whitespace-pre-wrap">
                {step.prompt}
              </pre>
            </div>

            {/* Result */}
            {step.result && (
              <>
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Output</h4>
                  <pre className="bg-gray-50 rounded p-3 text-xs font-mono text-gray-800 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {step.result.output}
                  </pre>
                </div>

                {/* Files Modified */}
                {step.result.filesModified.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Changed Files ({step.result.filesModified.length})
                    </h4>
                    <div className="space-y-2">
                      {step.result.filesModified.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <svg
                            className="w-4 h-4 text-blue-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <code className="text-gray-700 font-mono text-xs">{file}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error (if failed) */}
                {step.result.error && (
                  <div>
                    <h4 className="text-sm font-semibold text-red-700 mb-1">Error</h4>
                    <pre className="bg-red-50 border border-red-200 rounded p-3 text-xs font-mono text-red-800 overflow-x-auto whitespace-pre-wrap">
                      {step.result.error}
                    </pre>
                  </div>
                )}

                {/* Token usage */}
                {step.result.tokenUsage && (
                  <div className="text-xs text-gray-500">
                    Tokens: {step.result.tokenUsage.totalInputTokens.toLocaleString()} in /{' '}
                    {step.result.tokenUsage.totalOutputTokens.toLocaleString()} out
                  </div>
                )}
              </>
            )}

            {/* Dependencies */}
            {step.dependsOn && step.dependsOn.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1">Depends On</h4>
                <div className="flex gap-2 flex-wrap">
                  {step.dependsOn.map((depId) => (
                    <span
                      key={depId}
                      className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-700"
                    >
                      {depId}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Plan detail page with step timeline
 * 
 * Features:
 * - Real-time updates via WebSocket
 * - Step timeline with status icons
 * - Expandable steps with prompt, result, files
 * - Progress tracking
 */
export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: initialPlan, loading, error, refetch } = useApi<Plan>(`/api/plans/${id}`);
  const [plan, setPlan] = useState<Plan | null>(null);
  const { subscribe } = useWebSocket();

  // Initialize plan state
  useEffect(() => {
    if (initialPlan) {
      setPlan(initialPlan);
    }
  }, [initialPlan]);

  // Subscribe to plan events for live updates
  useEffect(() => {
    if (!id) return;

    const unsubscribes = [
      subscribe('plan:step:start', (payload) => {
        if (payload.planId === id) {
          setPlan((prev) => {
            if (!prev) return null;
            const steps = [...prev.steps];
            const step = steps.find((s) => s.id === payload.stepId);
            if (step) {
              step.status = 'running';
            }
            return { ...prev, steps, currentStepIndex: payload.stepIndex };
          });
        }
      }),

      subscribe('plan:step:end', (payload) => {
        if (payload.planId === id) {
          // Refetch to get complete step result
          refetch();
        }
      }),

      subscribe('plan:end', (payload) => {
        if (payload.planId === id) {
          refetch();
        }
      }),
    ];

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [id, subscribe, refetch]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-gray-600">Loading plan...</div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-semibold">Error loading plan</p>
            <p className="text-red-600 text-sm mt-1">{error || 'Plan not found'}</p>
          </div>
          <Link to="/plans" className="inline-block mt-4 text-blue-600 hover:text-blue-800 underline">
            ← Back to Plans
          </Link>
        </div>
      </div>
    );
  }

  const completedSteps = plan.steps.filter((step) => step.status === 'completed').length;
  const totalSteps = plan.steps.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link to="/plans" className="inline-block mb-3 text-blue-600 hover:text-blue-800 underline">
            ← Back to Plans
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-gray-900">{plan.title}</h1>
              {plan.description && (
                <p className="text-gray-600 mt-2">{plan.description}</p>
              )}
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                plan.status === 'running'
                  ? 'bg-blue-100 text-blue-800'
                  : plan.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : plan.status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {plan.status}
            </span>
          </div>

          {/* Metadata */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
            <span>Created {new Date(plan.createdAt).toLocaleString()}</span>
            <span>Updated {new Date(plan.updatedAt).toLocaleString()}</span>
            <span>Model: {plan.metadata.model}</span>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <StepProgress completed={completedSteps} total={totalSteps} />
          </div>
        </div>

        {/* Step Timeline */}
        <div className="space-y-6">
          {plan.steps.map((step, idx) => (
            <StepCard key={step.id} step={step} isLast={idx === plan.steps.length - 1} />
          ))}
        </div>

        {/* Total token usage (if available) */}
        {plan.metadata.totalTokenUsage && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Token Usage</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Input: {plan.metadata.totalTokenUsage.totalInputTokens.toLocaleString()}</div>
              <div>Output: {plan.metadata.totalTokenUsage.totalOutputTokens.toLocaleString()}</div>
              <div className="font-semibold">
                Total: {plan.metadata.totalTokenUsage.totalTokens.toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
