// src/tui/__tests__/app.test.tsx — App component tests (Gateway WebSocket client)

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { TuiWsProvider, type TuiWsContextValue } from '../providers/ws-provider.js';

// Mock the ws-provider to avoid real WebSocket connections
const mockSendCommand = vi.fn().mockResolvedValue([]);
const mockSend = vi.fn();

vi.mock('../providers/ws-provider.js', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require('react') as typeof import('react');

  const TuiWsContext = ReactMod.createContext<TuiWsContextValue | null>(null);

  function TuiWsProvider({ children }: { url: string; children: React.ReactNode }) {
    const value: TuiWsContextValue = {
      status: 'open' as const,
      lastMessage: null,
      send: mockSend,
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

// Mock the gateway health check
vi.mock('../../gateway/health.js', () => ({
  getGatewayWsUrl: () => 'ws://127.0.0.1:4800/ws',
  getGatewayHttpUrl: () => 'http://127.0.0.1:4800',
  isGatewayReachable: vi.fn().mockResolvedValue(true),
}));

describe('App (Gateway Client)', () => {
  it('should render with session panel and chat panel when connected', async () => {
    // Reset mock to return empty sessions
    mockSendCommand.mockResolvedValue([]);

    const { App } = await import('../app.js');
    const { lastFrame } = render(React.createElement(App));

    await vi.waitFor(() => {
      const output = lastFrame();
      expect(output).toContain('Sessions');
      expect(output).toContain('Ctrl+N');
    });
  });

  it('should toggle session panel with Ctrl+B', async () => {
    mockSendCommand.mockResolvedValue([]);

    const { App } = await import('../app.js');
    const { lastFrame, stdin } = render(React.createElement(App));

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Sessions');
    });

    // Toggle off
    stdin.write('\x02'); // Ctrl+B

    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain('Sessions');
    });

    // Toggle back on
    stdin.write('\x02');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Sessions');
    });
  });

  it('should show empty state when no sessions exist', async () => {
    mockSendCommand.mockResolvedValue([]);

    const { App } = await import('../app.js');
    const { lastFrame } = render(React.createElement(App));

    await vi.waitFor(() => {
      expect(lastFrame()).toContain('No sessions');
    });
  });
});
