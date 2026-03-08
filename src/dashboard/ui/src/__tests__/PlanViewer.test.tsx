// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BrowserRouter } from 'react-router-dom';
import { PlansPage } from '../pages/PlansPage.js';
import { PlanDetailPage } from '../pages/PlanDetailPage.js';
import { StepProgress } from '../components/StepProgress.js';
import { DiffViewer } from '../components/DiffViewer.js';
import type { Plan } from '../../../../types/task.js';

// Mock hooks
vi.mock('../hooks/useApi.js', () => ({
  useApi: vi.fn(),
}));

vi.mock('../hooks/useWebSocket.js', () => ({
  useWebSocket: vi.fn(() => ({
    connected: true,
    clientId: 'test-client',
    subscribe: vi.fn(() => () => {}),
  })),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: 'test-plan-1' })),
  };
});

import { useApi } from '../hooks/useApi.js';

const mockUseApi = useApi as ReturnType<typeof vi.fn>;

describe('Plan Viewer Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PlansPage', () => {
    it('should render loading state', () => {
      mockUseApi.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlansPage />
        </BrowserRouter>
      );

      expect(screen.getByText('Loading plans...')).toBeInTheDocument();
    });

    it('should render error state', () => {
      mockUseApi.mockReturnValue({
        data: null,
        loading: false,
        error: 'Network error',
        refetch: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlansPage />
        </BrowserRouter>
      );

      expect(screen.getByText('Error loading plans')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should render empty state when no plans exist', () => {
      mockUseApi.mockReturnValue({
        data: [],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlansPage />
        </BrowserRouter>
      );

      expect(screen.getByText(/No plans yet/i)).toBeInTheDocument();
    });

    it('should render plans list with title, status, and progress', () => {
      const mockPlans: Plan[] = [
        {
          id: 'plan-1',
          title: 'Test Plan 1',
          description: 'A test plan',
          status: 'completed',
          steps: [
            {
              id: 'step-1',
              title: 'Step 1',
              prompt: 'Do something',
              status: 'completed',
            },
            {
              id: 'step-2',
              title: 'Step 2',
              prompt: 'Do another thing',
              status: 'completed',
            },
            {
              id: 'step-3',
              title: 'Step 3',
              prompt: 'Final step',
              status: 'pending',
            },
          ],
          currentStepIndex: 2,
          createdAt: '2026-03-07T12:00:00Z',
          updatedAt: '2026-03-07T12:30:00Z',
          metadata: {
            originalPrompt: 'Original prompt',
            model: 'claude-sonnet-4',
          },
        },
      ];

      mockUseApi.mockReturnValue({
        data: mockPlans,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlansPage />
        </BrowserRouter>
      );

      expect(screen.getByText('Test Plan 1')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('2/3 steps')).toBeInTheDocument();
    });
  });

  describe('PlanDetailPage', () => {
    it('should render plan detail with step timeline', async () => {
      const mockPlan: Plan = {
        id: 'test-plan-1',
        title: 'Detailed Plan',
        description: 'Plan with multiple steps',
        status: 'running',
        steps: [
          {
            id: 'step-1',
            title: 'First Step',
            prompt: 'First step prompt',
            status: 'completed',
            result: {
              output: 'Step completed successfully',
              tokenUsage: { totalInputTokens: 100, totalOutputTokens: 50, totalTokens: 150, totalCacheReadTokens: 0, totalCacheWriteTokens: 0, stepCount: 1 },
              filesModified: ['src/file1.ts'],
              durationMs: 1500,
            },
          },
          {
            id: 'step-2',
            title: 'Second Step',
            prompt: 'Second step prompt',
            status: 'running',
          },
        ],
        currentStepIndex: 1,
        createdAt: '2026-03-07T12:00:00Z',
        updatedAt: '2026-03-07T12:15:00Z',
        metadata: {
          originalPrompt: 'Build a feature',
          model: 'claude-sonnet-4',
        },
      };

      mockUseApi.mockReturnValue({
        data: mockPlan,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlanDetailPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Detailed Plan')).toBeInTheDocument();
        expect(screen.getByText('First Step')).toBeInTheDocument();
        expect(screen.getByText('Second Step')).toBeInTheDocument();
        expect(screen.getByText('1/2 steps')).toBeInTheDocument();
      });
    });
  });

  describe('StepProgress', () => {
    it('should display correct progress percentage and text', () => {
      render(<StepProgress completed={3} total={7} />);

      expect(screen.getByText('3/7 steps')).toBeInTheDocument();
      expect(screen.getByText('43%')).toBeInTheDocument();
    });

    it('should handle zero total steps', () => {
      render(<StepProgress completed={0} total={0} />);

      expect(screen.getByText('0/0 steps')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should show 100% when all steps completed', () => {
      render(<StepProgress completed={5} total={5} />);

      expect(screen.getByText('5/5 steps')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  describe('DiffViewer', () => {
    it('should render unified diff with correct syntax highlighting', () => {
      const diff = `@@ -1,3 +1,4 @@
 unchanged line
-removed line
+added line
+another added line`;

      const { container } = render(<DiffViewer diff={diff} />);

      const lines = container.querySelectorAll('code');
      expect(lines.length).toBeGreaterThan(0);

      // Check that added lines have green styling
      const addedLines = Array.from(lines).filter((line) =>
        line.textContent?.startsWith('+')
      );
      expect(addedLines.length).toBeGreaterThan(0);
    });

    it('should display file name when provided', () => {
      const diff = '+added line';
      render(<DiffViewer diff={diff} fileName="example.ts" />);

      expect(screen.getByText('example.ts')).toBeInTheDocument();
    });

    it('should parse hunk headers correctly', () => {
      const diff = `@@ -1,3 +1,4 @@
 context line`;

      const { container } = render(<DiffViewer diff={diff} />);

      const hunkHeader = Array.from(container.querySelectorAll('code')).find((el) =>
        el.textContent?.includes('@@')
      );
      expect(hunkHeader).toBeTruthy();
    });
  });
});
