// src/cli/__tests__/dashboard-command.test.ts — Dashboard Command Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDashboardCommand } from '../dashboard-command.js';
import type { Command } from 'commander';

// Mock createDashboard to avoid actually starting the server in tests
vi.mock('../../dashboard/create-dashboard.js', () => ({
  createDashboard: vi.fn(async (config) => {
    // Mock dashboard instance
    return {
      server: {
        log: {
          info: vi.fn(),
          error: vi.fn(),
        },
        close: vi.fn(),
      },
      eventBus: {},
      start: vi.fn(async () => {
        // Check for port conflict simulation
        if (config?.port === 9999) {
          const error: NodeJS.ErrnoException = new Error('Port in use');
          error.code = 'EADDRINUSE';
          throw error;
        }
        // Simulate successful start
      }),
      stop: vi.fn(async () => {
        // Simulate successful stop
      }),
    };
  }),
}));

describe('Dashboard Command', () => {
  let command: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh command instance
    command = createDashboardCommand();

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Spy on process.exit and prevent actual exit
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
  });

  it('should create a command named "dashboard"', () => {
    expect(command.name()).toBe('dashboard');
  });

  it('should have a description', () => {
    expect(command.description()).toBeTruthy();
    expect(command.description()).toContain('dashboard');
  });

  it('should have a --port option', () => {
    const portOption = command.options.find((opt) => opt.long === '--port');
    expect(portOption).toBeDefined();
    expect(portOption?.short).toBe('-p');
  });

  it('should start dashboard with default port when no options provided', async () => {
    const { createDashboard } = await import('../../dashboard/create-dashboard.js');
    
    // Parse command with no arguments
    await command.parseAsync([], { from: 'user' });

    // Verify createDashboard was called with empty config
    expect(createDashboard).toHaveBeenCalledWith({});
    
    // Verify start was called
    const mockDashboard = await (createDashboard as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(mockDashboard.start).toHaveBeenCalled();

    // Verify success messages
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('started'));
  });

  it('should pass custom port to createDashboard', async () => {
    const { createDashboard } = await import('../../dashboard/create-dashboard.js');
    
    // Clear previous mocks
    vi.clearAllMocks();
    
    // Parse command with --port option
    await command.parseAsync(['--port', '8080'], { from: 'user' });

    // Verify createDashboard was called with port config
    expect(createDashboard).toHaveBeenCalledWith({ port: 8080 });
    
    // Verify start was called
    const mockDashboard = await (createDashboard as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(mockDashboard.start).toHaveBeenCalled();
  });

  it('should handle port conflict error with clear message', async () => {
    // Clear previous mocks
    vi.clearAllMocks();
    
    try {
      // Use port 9999 which triggers EADDRINUSE in our mock
      await command.parseAsync(['--port', '9999'], { from: 'user' });
    } catch (error) {
      // Expect process.exit to have been called (error thrown by mock)
      expect(String(error)).toContain('process.exit');
    }

    // Verify error message was printed
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('already in use'));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Try a different port'));
  });

  it('should create a working dashboard instance via factory', async () => {
    const { createDashboard } = await import('../../dashboard/create-dashboard.js');
    
    // Clear previous mocks
    vi.clearAllMocks();
    
    const dashboard = await createDashboard({ port: 4000 });

    // Verify instance structure
    expect(dashboard).toHaveProperty('server');
    expect(dashboard).toHaveProperty('eventBus');
    expect(dashboard).toHaveProperty('start');
    expect(dashboard).toHaveProperty('stop');
    
    // Verify start/stop are callable
    expect(typeof dashboard.start).toBe('function');
    expect(typeof dashboard.stop).toBe('function');
  });
});
