// @vitest-environment jsdom
// src/web/__tests__/chat-panel.test.tsx — ChatPanel, MessageList, ChatInput tests

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import type { ChatMessage } from '../../shared/types/ui.js';

// jsdom does not implement scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// --- Mock state ---
const mockSessionState = {
  sessions: [],
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
  messages: new Map<string, ChatMessage[]>(),
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

const mockRunState = {
  activeRunId: null as string | null,
  isRunning: false,
  tokenUsage: { input: 0, output: 0 },
  stepCount: 0,
  model: '',
  setRunning: vi.fn(),
  setEnded: vi.fn(),
  updateTokens: vi.fn(),
  incrementStep: vi.fn(),
  reset: vi.fn(),
};

vi.mock('../stores.js', () => ({
  sessionStore: {
    getState: () => mockSessionState,
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    getInitialState: () => mockSessionState,
  },
  chatStore: {
    getState: () => mockChatState,
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    getInitialState: () => mockChatState,
  },
  runStore: {
    getState: () => mockRunState,
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    getInitialState: () => mockRunState,
  },
  useSessionStore: (selector: (state: typeof mockSessionState) => unknown) =>
    selector(mockSessionState),
  useChatStore: (selector: (state: typeof mockChatState) => unknown) =>
    selector(mockChatState),
  useRunStore: (selector: (state: typeof mockRunState) => unknown) =>
    selector(mockRunState),
}));

// --- Mock WS provider ---
const mockSendCommand = vi.fn().mockResolvedValue(undefined);

vi.mock('../providers/ws-provider.js', () => ({
  useWs: () => ({
    status: 'open' as const,
    lastMessage: null,
    send: vi.fn(),
    sendCommand: mockSendCommand,
  }),
}));

// Import after mocks
const { ChatPanel } = await import('../components/chat-panel.js');

// --- Helpers ---

function makeMessage(
  content: string,
  role: ChatMessage['role'] = 'user',
): ChatMessage {
  return {
    role,
    content,
    timestamp: '2026-03-10T10:00:00Z',
  };
}

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionState.activeId = null;
    mockChatState.messages = new Map();
    mockChatState.streamingText = '';
    mockRunState.isRunning = false;
    mockRunState.activeRunId = null;
  });

  describe('no active session', () => {
    it('shows placeholder when no session is selected', () => {
      render(<ChatPanel />);

      expect(screen.getByText(/Select a session/)).toBeInTheDocument();
      expect(screen.getByText('Ctrl+N')).toBeInTheDocument();
    });
  });

  describe('with active session', () => {
    beforeEach(() => {
      mockSessionState.activeId = 'session-1';
    });

    it('renders chat input textarea', () => {
      render(<ChatPanel />);

      expect(
        screen.getByPlaceholderText('Type a message...'),
      ).toBeInTheDocument();
    });

    it('displays user and assistant messages', () => {
      mockChatState.messages = new Map([
        [
          'session-1',
          [
            makeMessage('Hello from user', 'user'),
            makeMessage('Hello from assistant', 'assistant'),
          ],
        ],
      ]);

      render(<ChatPanel />);

      expect(screen.getByText('Hello from user')).toBeInTheDocument();
      expect(screen.getByText('Hello from assistant')).toBeInTheDocument();
    });

    it('applies different styles for user vs assistant messages', () => {
      mockChatState.messages = new Map([
        [
          'session-1',
          [
            makeMessage('User msg', 'user'),
            makeMessage('Assistant msg', 'assistant'),
          ],
        ],
      ]);

      render(<ChatPanel />);

      const userBubble = screen.getByText('User msg').closest('div[class]')!;
      // Assistant message is wrapped in MarkdownRenderer, find the bubble container
      const assistantText = screen.getByText('Assistant msg');
      const assistantBubble = assistantText.closest('.bg-card')!;

      expect(userBubble.className).toContain('bg-primary');
      expect(assistantBubble).not.toBeNull();
      expect(assistantBubble.className).toContain('bg-card');
    });

    it('shows streaming text when a run is active', () => {
      mockRunState.isRunning = true;
      mockChatState.streamingText = 'Streaming response...';

      render(<ChatPanel />);

      expect(screen.getByText('Streaming response...')).toBeInTheDocument();
    });

    it('does not show streaming bubble when not running', () => {
      mockRunState.isRunning = false;
      mockChatState.streamingText = 'leftover text';

      render(<ChatPanel />);

      expect(
        screen.queryByText('leftover text'),
      ).not.toBeInTheDocument();
    });

    it('sends message on form submit', () => {
      render(<ChatPanel />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'My message' } });

      const form = textarea.closest('form')!;
      fireEvent.submit(form);

      expect(mockSendCommand).toHaveBeenCalledWith('send_message', {
        sessionId: 'session-1',
        prompt: 'My message',
      });
    });

    it('disables input when a run is active', () => {
      mockRunState.isRunning = true;

      render(<ChatPanel />);

      const textarea = screen.getByPlaceholderText('Running...');
      expect(textarea).toBeDisabled();
    });

    it('does not send empty messages', () => {
      render(<ChatPanel />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: '   ' } });

      const form = textarea.closest('form')!;
      fireEvent.submit(form);

      expect(mockSendCommand).not.toHaveBeenCalled();
    });

    it('sends message on Enter (without Shift)', () => {
      render(<ChatPanel />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(mockSendCommand).toHaveBeenCalledWith('send_message', {
        sessionId: 'session-1',
        prompt: 'Hello',
      });
    });

    it('does not send message on Shift+Enter', () => {
      render(<ChatPanel />);

      const textarea = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

      expect(mockSendCommand).not.toHaveBeenCalled();
    });
  });
});
