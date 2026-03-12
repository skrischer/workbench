// @vitest-environment jsdom
// src/web/__tests__/session-panel.test.tsx — SessionPanel component tests

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import type { SessionPreview } from '../../shared/types/ui.js';

// --- Mock stores ---
const mockSessionState = {
  sessions: [] as SessionPreview[],
  activeId: null as string | null,
  filter: '',
  isLoading: false,
  setActive: vi.fn(),
  addSession: vi.fn(),
  updateSession: vi.fn(),
  setSessions: vi.fn(),
  setFilter: vi.fn(),
  setLoading: vi.fn(),
};

const mockChatState = {
  messages: new Map(),
  streamingText: '',
  streamingToolCalls: new Map(),
  addMessage: vi.fn(),
  setMessages: vi.fn(),
  appendStreamDelta: vi.fn(),
  resetStreaming: vi.fn(),
  setToolCallStart: vi.fn(),
  appendToolInput: vi.fn(),
  setToolResult: vi.fn(),
  clear: vi.fn(),
};

// Create mock store objects with getState/setState/subscribe
const mockSessionStore = {
  getState: () => mockSessionState,
  setState: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
  getInitialState: () => mockSessionState,
};

const mockChatStore = {
  getState: () => mockChatState,
  setState: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
  getInitialState: () => mockChatState,
};

vi.mock('../stores.js', () => ({
  sessionStore: mockSessionStore,
  chatStore: mockChatStore,
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) =>
    selector(mockSessionState),
}));

// --- Mock WS provider ---
const mockSendCommand = vi.fn();
const mockSend = vi.fn();

vi.mock('../providers/ws-provider.js', () => ({
  useWs: () => ({
    status: 'open' as const,
    lastMessage: null,
    send: mockSend,
    sendCommand: mockSendCommand,
  }),
}));

// Import after mocks
const { SessionPanel } = await import('../components/session-panel.js');

// --- Test Helpers ---

function makeSession(id: string, overrides?: Partial<SessionPreview>): SessionPreview {
  return {
    id,
    status: 'completed',
    createdAt: '2026-03-10T10:00:00Z',
    updatedAt: '2026-03-10T10:00:00Z',
    messageCount: 5,
    promptPreview: `Session ${id} prompt preview`,
    ...overrides,
  };
}

describe('SessionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState.sessions = [];
    mockSessionState.activeId = null;
    mockSessionState.filter = '';
    mockSessionState.isLoading = false;
    mockSendCommand.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders header with "Sessions" title', () => {
    render(<SessionPanel />);
    expect(screen.getByText('Sessions')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<SessionPanel />);
    expect(screen.getByPlaceholderText('Search sessions...')).toBeInTheDocument();
  });

  it('renders "New session" button', () => {
    render(<SessionPanel />);
    expect(screen.getByLabelText('New session')).toBeInTheDocument();
  });

  it('shows "No sessions yet" when empty and not loading', () => {
    render(<SessionPanel />);
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
  });

  it('renders session items when sessions exist', () => {
    mockSessionState.sessions = [
      makeSession('s1', { promptPreview: 'Fix auth bug' }),
      makeSession('s2', { promptPreview: 'Add new feature' }),
    ];

    render(<SessionPanel />);

    expect(screen.getByText('Fix auth bug')).toBeInTheDocument();
    expect(screen.getByText('Add new feature')).toBeInTheDocument();
  });

  it('highlights the active session', () => {
    mockSessionState.sessions = [makeSession('s1'), makeSession('s2')];
    mockSessionState.activeId = 's1';

    render(<SessionPanel />);

    const buttons = screen.getAllByRole('button').filter(
      (b) => b.textContent?.includes('Session s1'),
    );
    expect(buttons[0].className).toContain('bg-primary-glow');
  });

  it('calls sendCommand("load_session") when a session is clicked', async () => {
    mockSessionState.sessions = [makeSession('s1')];
    mockSendCommand.mockResolvedValue({ messages: [] });

    render(<SessionPanel />);

    const sessionButton = screen.getByText('Session s1 prompt preview')
      .closest('button')!;
    fireEvent.click(sessionButton);

    expect(mockSessionState.setActive).toHaveBeenCalledWith('s1');
    expect(mockSendCommand).toHaveBeenCalledWith('load_session', { id: 's1' });
  });

  it('calls sendCommand("create_session") when New Session is clicked', () => {
    const newSession = makeSession('new-1');
    mockSendCommand.mockResolvedValue(newSession);

    render(<SessionPanel />);

    fireEvent.click(screen.getByLabelText('New session'));

    expect(mockSendCommand).toHaveBeenCalledWith('create_session');
  });

  it('filters sessions locally by promptPreview', () => {
    mockSessionState.sessions = [
      makeSession('s1', { promptPreview: 'Fix auth bug' }),
      makeSession('s2', { promptPreview: 'Add new feature' }),
    ];
    mockSessionState.filter = 'auth';

    render(<SessionPanel />);

    expect(screen.getByText('Fix auth bug')).toBeInTheDocument();
    expect(screen.queryByText('Add new feature')).not.toBeInTheDocument();
  });

  it('shows "No sessions found" when filter matches nothing', () => {
    mockSessionState.sessions = [
      makeSession('s1', { promptPreview: 'Fix auth bug' }),
    ];
    mockSessionState.filter = 'nonexistent';

    render(<SessionPanel />);

    expect(screen.getByText('No sessions found')).toBeInTheDocument();
  });

  it('debounces search input and calls search_sessions after 300ms', async () => {
    vi.useFakeTimers();
    mockSendCommand.mockResolvedValue([]);

    render(<SessionPanel />);

    const input = screen.getByPlaceholderText('Search sessions...');
    fireEvent.change(input, { target: { value: 'test query' } });

    // Should not call search immediately
    expect(mockSendCommand).not.toHaveBeenCalledWith(
      'search_sessions',
      expect.objectContaining({ query: 'test query' }),
    );

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(mockSendCommand).toHaveBeenCalledWith('search_sessions', {
      query: 'test query',
    });

    vi.useRealTimers();
  });

  it('shows message count in metadata', () => {
    mockSessionState.sessions = [
      makeSession('s1', { messageCount: 12 }),
    ];

    render(<SessionPanel />);

    expect(screen.getByText('12 msgs')).toBeInTheDocument();
  });

  it('shows "New session" for empty prompt preview', () => {
    mockSessionState.sessions = [
      makeSession('s1', { promptPreview: '' }),
    ];

    render(<SessionPanel />);

    expect(screen.getByText('New session')).toBeInTheDocument();
  });
});
