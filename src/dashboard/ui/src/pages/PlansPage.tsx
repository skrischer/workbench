// src/dashboard/ui/src/pages/PlansPage.tsx — Plan List Page

import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { StepProgress } from '../components/StepProgress.js';
import type { Plan } from '../../../../types/task.js';

/**
 * Get badge color based on plan status
 */
function getStatusBadgeClass(status: Plan['status']): string {
  switch (status) {
    case 'running':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    case 'pending':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Plans list page component
 * 
 * Displays all plans with:
 * - Title
 * - Status badge
 * - Step progress (completed/total)
 * - Link to detail page
 */
export function PlansPage() {
  const { data: plans, loading, error } = useApi<Plan[]>('/api/plans');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Plans</h1>
          <div className="text-gray-600">Loading plans...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Plans</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-semibold">Error loading plans</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const sortedPlans = [...(plans || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Plans</h1>
          <p className="text-gray-600 mt-1">Task execution plans and progress</p>
        </div>

        <Link to="/" className="inline-block mb-6 text-blue-600 hover:text-blue-800 underline">
          ← Back to Home
        </Link>

        {sortedPlans.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No plans yet. Create a task to generate a plan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedPlans.map((plan) => {
              const completedSteps = plan.steps.filter(
                (step) => step.status === 'completed'
              ).length;
              const totalSteps = plan.steps.length;

              return (
                <Link
                  key={plan.id}
                  to={`/plans/${plan.id}`}
                  className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-semibold text-gray-900 truncate">
                        {plan.title}
                      </h2>
                      {plan.description && (
                        <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                          {plan.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`ml-4 px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusBadgeClass(
                        plan.status
                      )}`}
                    >
                      {plan.status}
                    </span>
                  </div>

                  <StepProgress completed={completedSteps} total={totalSteps} />

                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span>Created {new Date(plan.createdAt).toLocaleString()}</span>
                    <span>Model: {plan.metadata.model}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
