// src/tui/__tests__/session-panel.test.tsx — Session panel tests (Gateway client)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';

const mockSendCommand = vi.fn();

// Mock ws-provider at module level
vi.mock('../providers/ws-provider.js', async () => {
  const ReactMod = await import('react');

  type WsStatus = 'connecting' | 'open' | 'closed' | 'error';

  interface TuiWsContextValue {
    status: WsStatus;
    lastMessage: null;
    send: ReturnType<typeof vi.fn>;
    sendCommand: typeof mockSendCommand;
  }

  const TuiWsContext = ReactMod.createContext<TuiWsContextValue | null>(null);

  function TuiWsProvider({ children }: { url: string; children: React.ReactNode }) {
    const value: TuiWsContextValue = {
      status: 'open',
      lastMessage: null,
      send: vi.fn(),
      sendCommand: mockSendCommand,
    };
    return ReactMod.createElement(TuiWsContext.Provider, { value }, children);
  }

  function useTuiWs(): TuiWsContextValue {
    const ctx = ReactMod.useContext(TuiWsContext);
    if (!ctx) throw new Error('useTuiWs must be used within TuiWsProvider');
    return ctx;
  }

  return { TuiWsProvider, useTuiWs };
});

// Import after mock setup
const { SessionPanel } = await import('../components/session-panel.js');
const { TuiWsProvider } = await import('../providers/ws-provider.js');

function renderWithProvider(element: React.ReactElement) {
  return render(
    <TuiWsProvider url="ws://test">
      {element}
    </TuiWsProvider>
  );
}

describe('SessionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show "No sessions" when empty', async () => {
    mockSendCommand.mockResolvedValue([]);

    const { lastFrame } = renderWithProvider(
      <SessionPanel isFocused={false} activeSessionId={null} onSelectSession={() => {}} />
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('No sessions');
    });
  });

  it('should display sessions with status icons', async () => {
    const sessions = [
      {
        id: 'aaaaaaaa-1111-2222-3333-444444444444',
        status: 'active' as const,
        createdAt: '2026-03-10T10:00:00Z',
        updatedAt: '2026-03-10T10:00:00Z',
        messageCount: 5,
        promptPreview: 'Explain the architecture',
      },
      {
        id: 'bbbbbbbb-1111-2222-3333-444444444444',
        status: 'completed' as const,
        createdAt: '2026-03-09T10:00:00Z',
        updatedAt: '2026-03-09T10:00:00Z',
        messageCount: 3,
        promptPreview: 'Fix the login bug',
      },
    ];
    mockSendCommand.mockResolvedValue(sessions);

    const { lastFrame } = renderWithProvider(
      <SessionPanel isFocused={false} activeSessionId={null} onSelectSession={() => {}} />
    );

    await vi.waitFor(() => {
      const output = lastFrame();
      expect(output).toContain('Explain the architecture');
      expect(output).toContain('Fix the login bug');
    });
  });

  it('should call onSelectSession when Enter is pressed', async () => {
    const sessions = [
      {
        id: 'aaaaaaaa-1111-2222-3333-444444444444',
        status: 'active' as const,
        createdAt: '2026-03-10T10:00:00Z',
        updatedAt: '2026-03-10T10:00:00Z',
        messageCount: 5,
        promptPreview: 'Test session prompt',
      },
    ];
    mockSendCommand.mockResolvedValue(sessions);
    const onSelect = vi.fn();

    const { lastFrame, stdin } = renderWithProvider(
      <SessionPanel isFocused={true} activeSessionId={null} onSelectSession={onSelect} />
    );

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Test session prompt');
    });

    stdin.write('\r');

    await vi.waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith('aaaaaaaa-1111-2222-3333-444444444444');
    });
  });
});
