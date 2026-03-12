// src/tui/__tests__/app.test.tsx — App component tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../app.js';
import { TypedEventBus } from '../../events/event-bus.js';
import { SessionStorage } from '../../storage/session-storage.js';

// Mock SessionStorage
vi.mock('../../storage/session-storage.js', () => {
  const MockSessionStorage = vi.fn().mockImplementation(() => ({
    list: vi.fn().mockResolvedValue({ data: [], total: 0, offset: 0, limit: 50 }),
    load: vi.fn().mockResolvedValue({
      id: 'test-session',
      agentId: 'test',
      messages: [],
      toolCalls: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    create: vi.fn().mockResolvedValue({
      id: 'new-session',
      agentId: 'default',
      messages: [],
      toolCalls: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    createSession: vi.fn().mockResolvedValue({
      id: 'new-session',
      agentId: 'default',
      messages: [],
      toolCalls: [],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    save: vi.fn().mockResolvedValue(undefined),
    addMessage: vi.fn().mockResolvedValue(undefined),
  }));
  return { SessionStorage: MockSessionStorage };
});

describe('App', () => {
  let eventBus: TypedEventBus;
  let sessionStorage: SessionStorage;

  beforeEach(() => {
    eventBus = new TypedEventBus();
    sessionStorage = new SessionStorage();
  });

  it('should render with session panel and chat panel', () => {
    const { lastFrame } = render(
      <App eventBus={eventBus} sessionStorage={sessionStorage} />
    );

    const output = lastFrame();
    expect(output).toBeDefined();
    // Should show Sessions header
    expect(output).toContain('Sessions');
    // Should show placeholder when no session is active
    expect(output).toContain('Ctrl+N');
  });

  it('should toggle session panel with Ctrl+B', async () => {
    const { lastFrame, stdin } = render(
      <App eventBus={eventBus} sessionStorage={sessionStorage} />
    );

    // Initially visible
    expect(lastFrame()).toContain('Sessions');

    // Toggle off
    stdin.write('\x02'); // Ctrl+B

    // After toggle, Sessions header should not be visible
    await vi.waitFor(() => {
      expect(lastFrame()).not.toContain('Sessions');
    });

    // Toggle back on
    stdin.write('\x02');
    await vi.waitFor(() => {
      expect(lastFrame()).toContain('Sessions');
    });
  });

  it('should show empty state when no sessions exist', () => {
    const { lastFrame } = render(
      <App eventBus={eventBus} sessionStorage={sessionStorage} />
    );

    const output = lastFrame();
    expect(output).toContain('No sessions');
  });
});
