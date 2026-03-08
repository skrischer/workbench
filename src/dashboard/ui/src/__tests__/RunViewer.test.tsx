// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import RunsPage from '../pages/RunsPage.js';
import RunDetailPage from '../pages/RunDetailPage.js';
import { ToolCallCard } from '../components/ToolCallCard.js';
import { MessageList } from '../components/MessageList.js';
import type { RunMetadata, RunLog, RunToolCall, RunMessage } from '../../../../types/run.js';
import type { UseApiResult } from '../hooks/useApi.js';
import type { UseWebSocketResult } from '../hooks/useWebSocket.js';

// Mock hooks
vi.mock('../hooks/useApi.js', () => ({
  useApi: vi.fn(),
}));

vi.mock('../hooks/useWebSocket.js', () => ({
  useWebSocket: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-run-123' }),
  };
});

import { useApi } from '../hooks/useApi.js';
import { useWebSocket } from '../hooks/useWebSocket.js';

const mockUseApi = useApi as ReturnType<typeof vi.fn>;
const mockUseWebSocket = useWebSocket as ReturnType<typeof vi.fn>;

describe('Run Viewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders RunsPage with list of runs', async () => {
    const mockRuns: RunMetadata[] = [
      {
        id: 'run-1',
        startedAt: '2024-01-01T10:00:00Z',
        endedAt: '2024-01-01T10:05:00Z',
        status: 'completed',
        prompt: 'Test prompt 1',
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      },
      {
        id: 'run-2',
        startedAt: '2024-01-01T11:00:00Z',
        status: 'running',
        prompt: 'Test prompt 2',
      },
    ];

    mockUseApi.mockReturnValue({
      data: mockRuns,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as UseApiResult<RunMetadata[]>);

    render(
      <BrowserRouter>
        <RunsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/run-1/i)).toBeInTheDocument();
      expect(screen.getByText(/run-2/i)).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('running')).toBeInTheDocument();
      expect(screen.getByText('300')).toBeInTheDocument();
    });
  });

  it('renders RunDetailPage with message timeline', async () => {
    const mockRun: RunLog = {
      metadata: {
        id: 'test-run-123',
        startedAt: '2024-01-01T10:00:00Z',
        endedAt: '2024-01-01T10:05:00Z',
        status: 'completed',
        prompt: 'Test run',
        tokenUsage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      },
      messages: [
        {
          role: 'user',
          content: 'Hello',
          stepIndex: 0,
        },
        {
          role: 'assistant',
          content: 'Hi there!',
          stepIndex: 1,
        },
      ],
      toolCalls: [],
    };

    mockUseApi.mockReturnValue({
      data: mockRun,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as UseApiResult<RunLog>);

    mockUseWebSocket.mockReturnValue({
      connected: true,
      clientId: 'client-123',
      subscribe: vi.fn(() => () => {}),
    } as UseWebSocketResult);

    render(
      <BrowserRouter>
        <RunDetailPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('test-run-123')).toBeInTheDocument();
      expect(screen.getByText('Hello')).toBeInTheDocument();
      expect(screen.getByText('Hi there!')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('● Live')).toBeInTheDocument();
    });
  });

  it('expands and collapses ToolCallCard', async () => {
    const mockToolCall: RunToolCall = {
      toolName: 'test_tool',
      input: { arg1: 'value1', arg2: 42 },
      output: 'Success',
      durationMs: 1234,
      stepIndex: 0,
    };

    render(<ToolCallCard toolCall={mockToolCall} />);

    // Should show tool name
    expect(screen.getByText('test_tool')).toBeInTheDocument();
    expect(screen.getByText(/Step 1/)).toBeInTheDocument();
    expect(screen.getByText(/1.23s/)).toBeInTheDocument();

    // Input/Output should not be visible initially
    expect(screen.queryByText('Input:')).not.toBeInTheDocument();

    // Click to expand
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Now input/output should be visible
    await waitFor(() => {
      expect(screen.getByText('Input:')).toBeInTheDocument();
      expect(screen.getByText('Output:')).toBeInTheDocument();
      expect(screen.getByText(/"arg1": "value1"/)).toBeInTheDocument();
      expect(screen.getByText(/Success/)).toBeInTheDocument();
    });

    // Click to collapse
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.queryByText('Input:')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no runs', async () => {
    mockUseApi.mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as UseApiResult<RunMetadata[]>);

    render(
      <BrowserRouter>
        <RunsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No runs found')).toBeInTheDocument();
    });
  });

  it('handles live updates via WebSocket', async () => {
    let subscribeCallback: (payload: unknown) => void = () => {};

    const mockRun: RunLog = {
      metadata: {
        id: 'test-run-123',
        startedAt: '2024-01-01T10:00:00Z',
        status: 'running',
        prompt: 'Test run',
      },
      messages: [],
      toolCalls: [],
    };

    mockUseApi.mockReturnValue({
      data: mockRun,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as UseApiResult<RunLog>);

    mockUseWebSocket.mockReturnValue({
      connected: true,
      clientId: 'client-123',
      subscribe: vi.fn((_pattern, callback: (payload: unknown) => void) => {
        subscribeCallback = callback;
        return () => {};
      }),
    } as UseWebSocketResult);

    render(
      <BrowserRouter>
        <RunDetailPage />
      </BrowserRouter>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText('test-run-123')).toBeInTheDocument();
    });

    // Simulate incoming WebSocket message
    subscribeCallback({
        runId: 'test-run-123',
        stepIndex: 0,
        message: {
          role: 'user',
          content: 'New message from WebSocket',
          timestamp: '2024-01-01T10:01:00Z',
        },
      });

    // Check that the new message appears
    await waitFor(() => {
      expect(screen.getByText('New message from WebSocket')).toBeInTheDocument();
    });
  });

  it('renders MessageList with role icons', () => {
    const messages: RunMessage[] = [
      { role: 'user', content: 'User message', stepIndex: 0 },
      { role: 'assistant', content: 'Assistant reply', stepIndex: 1 },
      { role: 'system', content: 'System info', stepIndex: 2 },
      { role: 'tool', content: 'Tool output', stepIndex: 3 },
    ];

    render(<MessageList messages={messages} />);

    expect(screen.getByText('User message')).toBeInTheDocument();
    expect(screen.getByText('Assistant reply')).toBeInTheDocument();
    expect(screen.getByText('System info')).toBeInTheDocument();
    expect(screen.getByText('Tool output')).toBeInTheDocument();

    // Check role labels
    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getByText('assistant')).toBeInTheDocument();
    expect(screen.getByText('system')).toBeInTheDocument();
    expect(screen.getByText('tool')).toBeInTheDocument();
  });
});
