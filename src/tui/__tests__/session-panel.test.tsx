// src/tui/__tests__/session-panel.test.tsx — Session panel tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { SessionPanel } from '../components/session-panel.js';
import { StorageContext } from '../context.js';
import type { SessionStorage } from '../../storage/session-storage.js';

function createMockStorage(sessions: Array<{
  id: string;
  status: 'active' | 'completed' | 'paused' | 'failed';
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  promptPreview?: string;
}>): SessionStorage {
  return {
    list: vi.fn().mockResolvedValue({
      data: sessions,
      total: sessions.length,
      offset: 0,
      limit: 50,
    }),
    load: vi.fn(),
    save: vi.fn(),
    create: vi.fn(),
    createSession: vi.fn(),
    addMessage: vi.fn(),
    appendMessage: vi.fn(),
  } as unknown as SessionStorage;
}

describe('SessionPanel', () => {
  it('should show "No sessions" when empty', async () => {
    const storage = createMockStorage([]);

    const { lastFrame } = render(
      <StorageContext.Provider value={storage}>
        <SessionPanel isFocused={false} activeSessionId={null} onSelectSession={() => {}} />
      </StorageContext.Provider>
    );

    // Wait for async state update
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
    const storage = createMockStorage(sessions);

    const { lastFrame } = render(
      <StorageContext.Provider value={storage}>
        <SessionPanel isFocused={false} activeSessionId={null} onSelectSession={() => {}} />
      </StorageContext.Provider>
    );

    await vi.waitFor(() => {
      const output = lastFrame();
      expect(output).toContain('●'); // active icon
      expect(output).toContain('○'); // completed icon
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
    const storage = createMockStorage(sessions);
    const onSelect = vi.fn();

    const { lastFrame, stdin } = render(
      <StorageContext.Provider value={storage}>
        <SessionPanel isFocused={true} activeSessionId={null} onSelectSession={onSelect} />
      </StorageContext.Provider>
    );

    // Wait for sessions to load and render
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Test session prompt');
    });

    // Press Enter to select
    stdin.write('\r');

    await vi.waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith('aaaaaaaa-1111-2222-3333-444444444444');
    });
  });
});
