// src/types/__tests__/ws-protocol.test.ts — WS Protocol Type Guard Tests

import { describe, it, expect } from 'vitest';
import { isWsCommandMessage, isServerMessage } from '../ws-protocol.js';

describe('isWsCommandMessage', () => {
  it('returns true for a valid command message', () => {
    const msg = {
      type: 'command',
      command: 'list_sessions',
      requestId: 'req-1',
      payload: {},
    };
    expect(isWsCommandMessage(msg)).toBe(true);
  });

  it('returns true when requestId and payload are missing (optional fields)', () => {
    const msg = { type: 'command', command: 'list_sessions' };
    expect(isWsCommandMessage(msg)).toBe(true);
  });

  it('returns true for all valid command values', () => {
    const commands = [
      'list_sessions',
      'load_session',
      'create_session',
      'send_message',
      'abort_run',
      'search_sessions',
    ];
    for (const command of commands) {
      expect(isWsCommandMessage({ type: 'command', command })).toBe(true);
    }
  });

  it('returns false when type is not "command"', () => {
    expect(isWsCommandMessage({ type: 'event', command: 'list_sessions' })).toBe(false);
    expect(isWsCommandMessage({ type: 'response', command: 'list_sessions' })).toBe(false);
  });

  it('returns false when command is missing', () => {
    expect(isWsCommandMessage({ type: 'command' })).toBe(false);
  });

  it('returns false when command is not a string', () => {
    expect(isWsCommandMessage({ type: 'command', command: 123 })).toBe(false);
    expect(isWsCommandMessage({ type: 'command', command: null })).toBe(false);
    expect(isWsCommandMessage({ type: 'command', command: undefined })).toBe(false);
    expect(isWsCommandMessage({ type: 'command', command: true })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isWsCommandMessage(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isWsCommandMessage(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isWsCommandMessage(42)).toBe(false);
    expect(isWsCommandMessage('hello')).toBe(false);
    expect(isWsCommandMessage(true)).toBe(false);
  });

  it('returns false for an empty object', () => {
    expect(isWsCommandMessage({})).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isWsCommandMessage([])).toBe(false);
    expect(isWsCommandMessage([{ type: 'command', command: 'list_sessions' }])).toBe(false);
  });
});

describe('isServerMessage', () => {
  it('returns true for an event message', () => {
    const msg = {
      type: 'event',
      event: 'run:start',
      data: { runId: 'r1', agentConfig: { model: 'm', systemPrompt: 's', maxSteps: 1 }, prompt: 'p' },
    };
    expect(isServerMessage(msg)).toBe(true);
  });

  it('returns true for a response message', () => {
    const msg = { type: 'response', requestId: 'req-1', data: { sessions: [] } };
    expect(isServerMessage(msg)).toBe(true);
  });

  it('returns true for a response message with error', () => {
    const msg = {
      type: 'response',
      requestId: 'req-1',
      data: null,
      error: { code: 'NOT_FOUND', message: 'Session not found' },
    };
    expect(isServerMessage(msg)).toBe(true);
  });

  it('returns false for a command message type', () => {
    expect(isServerMessage({ type: 'command', command: 'list_sessions' })).toBe(false);
  });

  it('returns false for unknown type values', () => {
    expect(isServerMessage({ type: 'unknown' })).toBe(false);
    expect(isServerMessage({ type: 'notification' })).toBe(false);
    expect(isServerMessage({ type: '' })).toBe(false);
  });

  it('returns false when type is missing', () => {
    expect(isServerMessage({ event: 'run:start', data: {} })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isServerMessage(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isServerMessage(undefined)).toBe(false);
  });

  it('returns false for primitive values', () => {
    expect(isServerMessage(42)).toBe(false);
    expect(isServerMessage('event')).toBe(false);
    expect(isServerMessage(true)).toBe(false);
  });

  it('returns false for an empty object', () => {
    expect(isServerMessage({})).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isServerMessage([])).toBe(false);
  });
});
