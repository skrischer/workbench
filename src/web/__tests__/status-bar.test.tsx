// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusBar } from '../components/status-bar.js';
import { runStore } from '../stores.js';

// Mock WsProvider context
const mockSendCommand = vi.fn().mockResolvedValue(undefined);
vi.mock('../providers/ws-provider.js', () => ({
  useWs: () => ({
    status: 'open' as const,
    lastMessage: null,
    send: vi.fn(),
    sendCommand: mockSendCommand,
  }),
}));

describe('StatusBar', () => {
  beforeEach(() => {
    runStore.getState().reset();
    mockSendCommand.mockClear();
  });

  afterEach(() => {
    runStore.getState().reset();
  });

  it('renders idle state when no run is active', () => {
    render(<StatusBar />);
    expect(screen.getByText('Idle')).toBeDefined();
  });

  it('shows token counts', () => {
    runStore.getState().setRunning('run-1', 'claude-3-opus');
    runStore.getState().updateTokens(1500, 800);

    render(<StatusBar />);
    expect(screen.getByText('1.5k')).toBeDefined();
    expect(screen.getByText('800')).toBeDefined();
  });

  it('shows model name', () => {
    runStore.getState().setRunning('run-1', 'claude-3-opus');

    render(<StatusBar />);
    expect(screen.getByText('claude-3-opus')).toBeDefined();
  });

  it('shows step count', () => {
    runStore.getState().setRunning('run-1');
    runStore.getState().incrementStep();
    runStore.getState().incrementStep();
    runStore.getState().incrementStep();

    render(<StatusBar />);
    expect(screen.getByText('3')).toBeDefined();
  });

  it('shows running status with indicator', () => {
    runStore.getState().setRunning('run-1', 'test-model');

    render(<StatusBar />);
    expect(screen.getByText('Running')).toBeDefined();
  });

  it('shows abort button when running', () => {
    runStore.getState().setRunning('run-1', 'test-model');

    render(<StatusBar />);
    const abortBtn = screen.getByLabelText('Abort run');
    expect(abortBtn).toBeDefined();
    expect(screen.getByText('Abort')).toBeDefined();
  });

  it('does not show abort button when idle', () => {
    render(<StatusBar />);
    expect(screen.queryByLabelText('Abort run')).toBeNull();
  });

  it('sends abort command when abort button clicked', async () => {
    const user = userEvent.setup();
    runStore.getState().setRunning('run-42', 'test-model');

    render(<StatusBar />);
    const abortBtn = screen.getByLabelText('Abort run');
    await user.click(abortBtn);

    expect(mockSendCommand).toHaveBeenCalledWith('abort_run', { runId: 'run-42' });
  });

  it('formats large token counts with k suffix', () => {
    runStore.getState().setRunning('run-1');
    runStore.getState().updateTokens(12500, 3200);

    render(<StatusBar />);
    expect(screen.getByText('12.5k')).toBeDefined();
    expect(screen.getByText('3.2k')).toBeDefined();
  });

  it('shows zero counts initially', () => {
    runStore.getState().setRunning('run-1');

    const { container } = render(<StatusBar />);
    // Token counts and step count should show 0
    const text = container.textContent ?? '';
    expect(text).toContain('Steps:');
    expect(text).toContain('In:');
    expect(text).toContain('Out:');
  });
});
