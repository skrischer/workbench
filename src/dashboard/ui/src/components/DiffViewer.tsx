// src/dashboard/ui/src/components/DiffViewer.tsx — Unified Diff Viewer

interface DiffViewerProps {
  diff: string;
  fileName?: string;
  className?: string;
}

interface DiffLine {
  type: 'header' | 'added' | 'removed' | 'context' | 'hunk';
  content: string;
  lineNumber?: number;
}

/**
 * Parse unified diff format into structured lines
 */
function parseDiff(diff: string): DiffLine[] {
  const lines = diff.split('\n');
  const result: DiffLine[] = [];
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      // Hunk header: @@ -1,3 +1,4 @@
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
      result.push({ type: 'hunk', content: line });
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      // File header
      result.push({ type: 'header', content: line });
    } else if (line.startsWith('+')) {
      // Added line
      result.push({ type: 'added', content: line, lineNumber: newLineNum });
      newLineNum++;
    } else if (line.startsWith('-')) {
      // Removed line
      result.push({ type: 'removed', content: line, lineNumber: oldLineNum });
      oldLineNum++;
    } else {
      // Context line (unchanged)
      result.push({ type: 'context', content: line, lineNumber: newLineNum });
      oldLineNum++;
      newLineNum++;
    }
  }

  return result;
}

/**
 * Display unified diff with syntax highlighting
 * 
 * Features:
 * - Green background for additions
 * - Red background for deletions
 * - Line numbers
 * - Monospace font with proper formatting
 * 
 * @example
 * ```tsx
 * <DiffViewer diff={step.result.diff} fileName="example.ts" />
 * ```
 */
export function DiffViewer({ diff, fileName, className = '' }: DiffViewerProps) {
  const lines = parseDiff(diff);

  return (
    <div className={`rounded-lg border border-gray-300 overflow-hidden ${className}`}>
      {fileName && (
        <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
          <span className="text-sm font-mono font-semibold text-gray-700">{fileName}</span>
        </div>
      )}
      <div className="bg-gray-50 overflow-x-auto">
        <pre className="text-xs font-mono p-0 m-0">
          {lines.map((line, idx) => {
            let bgColor = '';
            let textColor = 'text-gray-900';

            if (line.type === 'added') {
              bgColor = 'bg-green-100';
              textColor = 'text-green-800';
            } else if (line.type === 'removed') {
              bgColor = 'bg-red-100';
              textColor = 'text-red-800';
            } else if (line.type === 'hunk') {
              bgColor = 'bg-blue-50';
              textColor = 'text-blue-700';
            } else if (line.type === 'header') {
              bgColor = 'bg-gray-100';
              textColor = 'text-gray-600';
            }

            return (
              <div
                key={idx}
                className={`flex ${bgColor} hover:bg-opacity-80 transition-colors`}
              >
                <span className="inline-block w-12 text-right pr-3 py-0.5 text-gray-500 select-none border-r border-gray-300">
                  {line.lineNumber ?? ''}
                </span>
                <code className={`flex-1 pl-3 py-0.5 ${textColor}`}>
                  {line.content || ' '}
                </code>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}
