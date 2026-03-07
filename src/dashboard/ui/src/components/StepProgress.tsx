// src/dashboard/ui/src/components/StepProgress.tsx — Step Progress Bar Component

interface StepProgressProps {
  completed: number;
  total: number;
  className?: string;
}

/**
 * Visual progress bar showing completed/total steps
 * 
 * @example
 * ```tsx
 * <StepProgress completed={3} total={7} />
 * // Renders: "3/7 steps" with 43% progress bar
 * ```
 */
export function StepProgress({ completed, total, className = '' }: StepProgressProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {completed}/{total} steps
        </span>
        <span className="text-gray-500 font-medium">{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
