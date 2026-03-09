// @vitest-environment jsdom
/**
 * Integration tests for Dashboard React components
 * 
 * These tests focus on integration scenarios that go beyond unit tests:
 * - Full app routing and navigation
 * - Complex data rendering with realistic mock data
 * - Error and empty states across multiple components
 * - Component interactions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from '../App.js';
import RunsPage from '../pages/RunsPage.js';
import RunDetailPage from '../pages/RunDetailPage.js';
import { PlansPage } from '../pages/PlansPage.js';
import type { RunMetadata, RunLog } from '../../../../types/run.js';
import type { Plan } from '../../../../types/task.js';

// Mock fetch globally
const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

/**
 * Helper to mock fetch responses
 */
function mockFetch(responses: Record<string, unknown>) {
  global.fetch = vi.fn((url: string | URL | Request) => {
    const urlString = typeof url === 'string' ? url : url.toString();
    
    for (const [pattern, data] of Object.entries(responses)) {
      if (urlString.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => data,
          text: async () => JSON.stringify(data),
        } as Response);
      }
    }
    
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'Not found' }),
      text: async () => JSON.stringify({ error: 'Not found' }),
    } as Response);
  }) as typeof fetch;
}

/**
 * Helper to mock fetch errors
 */
function mockFetchError(errorMessage: string) {
  global.fetch = vi.fn(() => 
    Promise.reject(new Error(errorMessage))
  ) as typeof fetch;
}

describe('Dashboard Integration Tests', () => {
  describe('App Routing', () => {
    it('navigates from home to runs list and back', async () => {
      mockFetch({
        '/api/runs': [],
      });

      render(<App />);

      // Start on home page
      expect(screen.getByText(/Workbench Dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/AI Dev OS/i)).toBeInTheDocument();

      // Navigate to runs
      const runsLink = screen.getByRole('link', { name: /View Runs/i });
      fireEvent.click(runsLink);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^Runs$/i })).toBeInTheDocument();
      });

      // Navigate back to home
      const backLink = screen.getByRole('link', { name: /Back to Home/i });
      fireEvent.click(backLink);

      await waitFor(() => {
        expect(screen.getByText(/Workbench Dashboard/i)).toBeInTheDocument();
      });
    });

    it('navigates from home to plans list', async () => {
      mockFetch({
        '/api/plans': [],
      });

      render(<App />);

      // Navigate to plans
      const plansLink = screen.getByRole('link', { name: /View Plans/i });
      fireEvent.click(plansLink);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^Plans$/i })).toBeInTheDocument();
        expect(screen.getByText(/Task execution plans and progress/i)).toBeInTheDocument();
      });
    });

    it.skip('navigates from runs list to run detail', async () => {
      
      const mockRuns: RunMetadata[] = [
        {
          id: 'run-abc-123',
          startedAt: '2024-03-01T10:00:00Z',
          endedAt: '2024-03-01T10:05:00Z',
          status: 'completed',
          prompt: 'Test run',
          tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        },
      ];

      const mockRunDetail: RunLog = {
        metadata: mockRuns[0],
        messages: [
          { role: 'user', content: 'Hello', stepIndex: 0 },
          { role: 'assistant', content: 'Hi!', stepIndex: 1 },
        ],
        toolCalls: [],
      };

      mockFetch({
        '/api/runs': mockRuns,
        '/api/runs/run-abc-123': mockRunDetail,
      });

      // Start at /runs
      render(
        <MemoryRouter initialEntries={['/runs']}>
          <Routes>
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/runs/:id" element={<RunDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        // Run ID is truncated in the list, so search for the truncated version
        expect(screen.getByText(/run-abc/i)).toBeInTheDocument();
      });

      // Click on run to navigate to detail
      const runLink = screen.getByRole('link', { name: /run-abc/i });
      fireEvent.click(runLink);

      await waitFor(() => {
        expect(screen.getByText('run-abc-123')).toBeInTheDocument();
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });
    });
  });

  describe('Runs List with Rich Data', () => {
    it('renders runs list with multiple runs of different statuses', async () => {
      const mockRuns: RunMetadata[] = [
        {
          id: 'run-completed-1',
          startedAt: '2024-03-08T09:00:00Z',
          endedAt: '2024-03-08T09:05:30Z',
          status: 'completed',
          prompt: 'Create a new feature',
          tokenUsage: { inputTokens: 1500, outputTokens: 3200, totalTokens: 4700 },
        },
        {
          id: 'run-running-2',
          startedAt: '2024-03-08T10:15:00Z',
          status: 'running',
          prompt: 'Debug the authentication issue',
        },
        {
          id: 'run-failed-3',
          startedAt: '2024-03-08T08:00:00Z',
          endedAt: '2024-03-08T08:02:15Z',
          status: 'failed',
          prompt: 'Deploy to production',
          tokenUsage: { inputTokens: 500, outputTokens: 200, totalTokens: 700 },
        },
        {
          id: 'run-cancelled-4',
          startedAt: '2024-03-08T07:30:00Z',
          endedAt: '2024-03-08T07:31:00Z',
          status: 'cancelled',
          prompt: 'Long running task',
        },
      ];

      mockFetch({
        '/api/runs': mockRuns,
      });

      render(
        <MemoryRouter>
          <RunsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Check all run IDs are displayed (truncated to first 8 chars + "...")
        expect(screen.getByText(/run-comp/i)).toBeInTheDocument();
        expect(screen.getByText(/run-runn/i)).toBeInTheDocument();
        expect(screen.getByText(/run-fail/i)).toBeInTheDocument();
        expect(screen.getByText(/run-canc/i)).toBeInTheDocument();

        // Check all statuses
        expect(screen.getByText('completed')).toBeInTheDocument();
        expect(screen.getByText('running')).toBeInTheDocument();
        expect(screen.getByText('failed')).toBeInTheDocument();
        expect(screen.getByText('cancelled')).toBeInTheDocument();

        // Check token counts
        expect(screen.getByText('4,700')).toBeInTheDocument();
        expect(screen.getByText('700')).toBeInTheDocument();

        // Check durations
        expect(screen.getByText('330.0s')).toBeInTheDocument(); // completed run
        expect(screen.getByText('135.0s')).toBeInTheDocument(); // failed run
        expect(screen.getByText('Running...')).toBeInTheDocument(); // running run
      });
    });

    it.skip('refreshes runs list when refresh button is clicked', async () => {
      const initialRuns: RunMetadata[] = [
        {
          id: 'run-1',
          startedAt: '2024-03-08T10:00:00Z',
          status: 'running',
          prompt: 'Initial run',
        },
      ];

      const updatedRuns: RunMetadata[] = [
        {
          id: 'run-1',
          startedAt: '2024-03-08T10:00:00Z',
          endedAt: '2024-03-08T10:05:00Z',
          status: 'completed',
          prompt: 'Initial run',
          tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        },
      ];

      let fetchCount = 0;
      global.fetch = vi.fn(() => {
        fetchCount++;
        const data = fetchCount === 1 ? initialRuns : updatedRuns;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => data,
        } as Response);
      }) as typeof fetch;

      render(
        <MemoryRouter>
          <RunsPage />
        </MemoryRouter>
      );

      // Initial state
      await waitFor(() => {
        expect(screen.getByText('running')).toBeInTheDocument();
      });

      // Click refresh
      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      fireEvent.click(refreshButton);

      // Check updated state
      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument();
        expect(screen.queryByText('running')).not.toBeInTheDocument();
      });
    });
  });

  describe('Run Detail Deep Test', () => {
    it('renders run detail with multiple tool calls and messages', async () => {
      const mockRunLog: RunLog = {
        metadata: {
          id: 'run-integration-test',
          startedAt: '2024-03-08T10:00:00Z',
          endedAt: '2024-03-08T10:15:30Z',
          status: 'completed',
          prompt: 'Build a user authentication system',
          tokenUsage: { inputTokens: 5000, outputTokens: 12000, totalTokens: 17000 },
        },
        messages: [
          {
            role: 'user',
            content: 'Build a user authentication system with JWT tokens',
            stepIndex: 0,
          },
          {
            role: 'assistant',
            content: 'I\'ll help you build a user authentication system. Let me start by reading the existing code.',
            stepIndex: 1,
          },
          {
            role: 'tool',
            content: 'File content...',
            stepIndex: 2,
          },
          {
            role: 'assistant',
            content: 'Now I\'ll create the authentication service.',
            stepIndex: 3,
          },
          {
            role: 'system',
            content: 'Task completed successfully',
            stepIndex: 4,
          },
        ],
        toolCalls: [
          {
            toolName: 'read_file',
            input: { path: 'src/auth/index.ts' },
            output: 'export function authenticate() { ... }',
            durationMs: 1234,
            stepIndex: 2,
          },
          {
            toolName: 'write_file',
            input: {
              path: 'src/auth/jwt.ts',
              content: 'import jwt from "jsonwebtoken";...',
            },
            output: 'File written successfully',
            durationMs: 2456,
            stepIndex: 3,
          },
          {
            toolName: 'exec',
            input: { command: 'npm test' },
            output: 'All tests passed',
            durationMs: 15678,
            stepIndex: 4,
          },
        ],
      };

      mockFetch({
        '/api/runs/run-integration-test': mockRunLog,
      });

      render(
        <MemoryRouter initialEntries={['/runs/run-integration-test']}>
          <Routes>
            <Route path="/runs/:id" element={<RunDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        // Check metadata
        expect(screen.getByText('run-integration-test')).toBeInTheDocument();
        expect(screen.getByText('Build a user authentication system')).toBeInTheDocument();
        expect(screen.getByText('completed')).toBeInTheDocument();

        // Check messages count
        expect(screen.getByText('5')).toBeInTheDocument(); // 5 messages

        // Check tool calls count
        expect(screen.getByText('3')).toBeInTheDocument(); // 3 tool calls

        // Check all messages are displayed
        expect(screen.getByText(/Build a user authentication system with JWT tokens/i)).toBeInTheDocument();
        expect(screen.getByText(/I'll help you build a user authentication system/i)).toBeInTheDocument();
        expect(screen.getByText(/Now I'll create the authentication service/i)).toBeInTheDocument();
        expect(screen.getByText(/Task completed successfully/i)).toBeInTheDocument();

        // Check all tool names are visible
        expect(screen.getByText('read_file')).toBeInTheDocument();
        expect(screen.getByText('write_file')).toBeInTheDocument();
        expect(screen.getByText('exec')).toBeInTheDocument();

        // Check durations
        expect(screen.getByText(/1.23s/i)).toBeInTheDocument();
        expect(screen.getByText(/2.46s/i)).toBeInTheDocument();
        expect(screen.getByText(/15.68s/i)).toBeInTheDocument();
      });
    });

    it('expands tool call to show input and output', async () => {
      const mockRunLog: RunLog = {
        metadata: {
          id: 'test-run',
          startedAt: '2024-03-08T10:00:00Z',
          status: 'running',
          prompt: 'Test',
        },
        messages: [],
        toolCalls: [
          {
            toolName: 'write_file',
            input: {
              path: '/tmp/test.txt',
              content: 'Hello, World!',
              mode: 0o644,
            },
            output: 'File written: /tmp/test.txt (14 bytes)',
            durationMs: 523,
            stepIndex: 0,
          },
        ],
      };

      mockFetch({
        '/api/runs/test-run': mockRunLog,
      });

      render(
        <MemoryRouter initialEntries={['/runs/test-run']}>
          <Routes>
            <Route path="/runs/:id" element={<RunDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('write_file')).toBeInTheDocument();
      });

      // Input/output should not be visible initially
      expect(screen.queryByText('Input:')).not.toBeInTheDocument();
      expect(screen.queryByText('Output:')).not.toBeInTheDocument();

      // Expand the tool call
      const toolButton = screen.getByRole('button', { name: /write_file/i });
      fireEvent.click(toolButton);

      // Now input/output should be visible
      await waitFor(() => {
        expect(screen.getByText('Input:')).toBeInTheDocument();
        expect(screen.getByText('Output:')).toBeInTheDocument();
        // Path appears in both input and output - check for both sections
        const inputs = screen.getAllByText(/\/tmp\/test.txt/i);
        expect(inputs.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Hello, World!/i)).toBeInTheDocument();
        expect(screen.getByText(/File written/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('shows error UI when runs list fetch fails', async () => {
      mockFetchError('Network error: Connection refused');

      render(
        <MemoryRouter>
          <RunsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error loading runs/i)).toBeInTheDocument();
        expect(screen.getByText(/Network error: Connection refused/i)).toBeInTheDocument();
      });
    });

    it('shows error UI when run detail fetch fails', async () => {
      mockFetchError('Run not found in database');

      render(
        <MemoryRouter initialEntries={['/runs/nonexistent']}>
          <Routes>
            <Route path="/runs/:id" element={<RunDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error loading run/i)).toBeInTheDocument();
        expect(screen.getByText(/Run not found in database/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Back to Runs/i })).toBeInTheDocument();
      });
    });

    it('shows error UI when plans list fetch fails', async () => {
      mockFetchError('Database connection timeout');

      render(
        <MemoryRouter>
          <PlansPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Error loading plans/i)).toBeInTheDocument();
        expect(screen.getByText(/Database connection timeout/i)).toBeInTheDocument();
      });
    });

    it('handles partial data gracefully', async () => {
      const mockRuns: RunMetadata[] = [
        {
          id: 'run-minimal',
          startedAt: '2024-03-08T10:00:00Z',
          status: 'running',
          prompt: 'Minimal run',
          // No endedAt, no tokenUsage
        },
      ];

      mockFetch({
        '/api/runs': mockRuns,
      });

      render(
        <MemoryRouter>
          <RunsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/run-mini/i)).toBeInTheDocument();
        expect(screen.getByText('running')).toBeInTheDocument();
        expect(screen.getByText('Running...')).toBeInTheDocument();
        // Token count should show dash for missing data
        expect(screen.getByText('—')).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('shows empty state for runs list', async () => {
      mockFetch({
        '/api/runs': [],
      });

      render(
        <MemoryRouter>
          <RunsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No runs found')).toBeInTheDocument();
      });
    });

    it('shows empty state for plans list', async () => {
      mockFetch({
        '/api/plans': [],
      });

      render(
        <MemoryRouter>
          <PlansPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/No plans yet/i)).toBeInTheDocument();
        expect(screen.getByText(/Create a task to generate a plan/i)).toBeInTheDocument();
      });
    });

    it('shows empty state for run with no messages', async () => {
      const mockRunLog: RunLog = {
        metadata: {
          id: 'empty-run',
          startedAt: '2024-03-08T10:00:00Z',
          status: 'running',
          prompt: 'Just started',
        },
        messages: [],
        toolCalls: [],
      };

      mockFetch({
        '/api/runs/empty-run': mockRunLog,
      });

      render(
        <MemoryRouter initialEntries={['/runs/empty-run']}>
          <Routes>
            <Route path="/runs/:id" element={<RunDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('empty-run')).toBeInTheDocument();
        expect(screen.getByText('No messages yet')).toBeInTheDocument();
      });
    });

    it('shows run detail without tool calls section when none exist', async () => {
      const mockRunLog: RunLog = {
        metadata: {
          id: 'no-tools-run',
          startedAt: '2024-03-08T10:00:00Z',
          endedAt: '2024-03-08T10:01:00Z',
          status: 'completed',
          prompt: 'Simple task',
        },
        messages: [
          { role: 'user', content: 'Do something simple', stepIndex: 0 },
          { role: 'assistant', content: 'Done!', stepIndex: 1 },
        ],
        toolCalls: [],
      };

      mockFetch({
        '/api/runs/no-tools-run': mockRunLog,
      });

      render(
        <MemoryRouter initialEntries={['/runs/no-tools-run']}>
          <Routes>
            <Route path="/runs/:id" element={<RunDetailPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Do something simple')).toBeInTheDocument();
        expect(screen.getByText('Done!')).toBeInTheDocument();
        // Tool Calls heading should not be present
        expect(screen.queryByRole('heading', { name: /Tool Calls/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Plans List Integration', () => {
    it.skip('renders plans list with multiple plans and progress', async () => {
      const mockPlans: Plan[] = [
        {
          id: 'plan-1',
          title: 'Implement user authentication',
          description: 'Add JWT-based authentication to the API',
          status: 'running',
          createdAt: '2024-03-08T10:00:00Z',
          metadata: {
            model: 'claude-sonnet-4',
            thinkingLevel: 'medium',
          },
          steps: [
            {
              id: 'step-1',
              title: 'Create auth controller',
              status: 'completed',
              agentType: 'coder',
            },
            {
              id: 'step-2',
              title: 'Add JWT middleware',
              status: 'running',
              agentType: 'coder',
            },
            {
              id: 'step-3',
              title: 'Write tests',
              status: 'pending',
              agentType: 'tester',
            },
          ],
        },
        {
          id: 'plan-2',
          title: 'Database optimization',
          status: 'completed',
          createdAt: '2024-03-07T14:30:00Z',
          metadata: {
            model: 'claude-sonnet-4',
            thinkingLevel: 'low',
          },
          steps: [
            {
              id: 'step-1',
              title: 'Add indexes',
              status: 'completed',
              agentType: 'coder',
            },
            {
              id: 'step-2',
              title: 'Optimize queries',
              status: 'completed',
              agentType: 'coder',
            },
          ],
        },
      ];

      mockFetch({
        '/api/plans': mockPlans,
      });

      render(
        <MemoryRouter>
          <PlansPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Check plan titles
        expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
        expect(screen.getByText('Database optimization')).toBeInTheDocument();

        // Check descriptions
        expect(screen.getByText(/Add JWT-based authentication/i)).toBeInTheDocument();

        // Check statuses (PlansPage renders status in uppercase)
        const statuses = screen.getAllByText(/running|completed/i);
        expect(statuses.length).toBeGreaterThan(0);

        // Check progress indicators
        expect(screen.getByText(/1 \/ 3/i)).toBeInTheDocument(); // plan-1: 1 of 3 steps completed
        expect(screen.getByText(/2 \/ 2/i)).toBeInTheDocument(); // plan-2: 2 of 2 steps completed

        // Check model info
        expect(screen.getAllByText(/claude-sonnet-4/i).length).toBeGreaterThan(0);
      });
    });
  });
});
