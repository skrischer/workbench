// src/tui/__tests__/tool-call-block.test.tsx — ToolCallBlock tests

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ToolCallBlock, type ToolCallData } from '../components/tool-call-block.js';

describe('ToolCallBlock', () => {
  it('should render collapsed tool call', () => {
    const data: ToolCallData = {
      toolId: 'tc-1',
      toolName: 'read_file',
      input: { path: '/tmp/test.txt' },
      result: 'file contents',
      isRunning: false,
    };
    const { lastFrame } = render(<ToolCallBlock data={data} />);
    const output = lastFrame();
    expect(output).toContain('read_file');
    expect(output).toContain('▶');
  });

  it('should show success icon for completed tool call', () => {
    const data: ToolCallData = {
      toolId: 'tc-2',
      toolName: 'write_file',
      input: { path: '/tmp/out.txt', content: 'hello' },
      result: 'success',
      isError: false,
      isRunning: false,
    };
    const { lastFrame } = render(<ToolCallBlock data={data} />);
    expect(lastFrame()).toContain('✓');
  });

  it('should show error icon for failed tool call', () => {
    const data: ToolCallData = {
      toolId: 'tc-3',
      toolName: 'exec',
      input: { command: 'rm -rf /' },
      result: 'Error: Permission denied',
      isError: true,
      isRunning: false,
    };
    const { lastFrame } = render(<ToolCallBlock data={data} />);
    expect(lastFrame()).toContain('✗');
  });

  it('should show duration when available', () => {
    const data: ToolCallData = {
      toolId: 'tc-4',
      toolName: 'read_file',
      input: {},
      result: 'ok',
      isRunning: false,
      durationMs: 150,
    };
    const { lastFrame } = render(<ToolCallBlock data={data} />);
    expect(lastFrame()).toContain('150ms');
  });

  it('should show spinner when running', () => {
    const data: ToolCallData = {
      toolId: 'tc-5',
      toolName: 'exec',
      input: { command: 'npm test' },
      isRunning: true,
    };
    const { lastFrame } = render(<ToolCallBlock data={data} />);
    const output = lastFrame();
    expect(output).toContain('exec');
    // Should not show ✓ or ✗
    expect(output).not.toContain('✓');
    expect(output).not.toContain('✗');
  });
});
