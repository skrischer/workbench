// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolCallBlock } from '../components/tool-call-block.js';
import type { ToolCallState } from '../../shared/types/ui.js';

function makeToolCall(overrides: Partial<ToolCallState> = {}): ToolCallState {
  return {
    toolId: 'tc-1',
    toolName: 'read_file',
    input: '{"path": "/tmp/test.ts"}',
    status: 'success',
    result: 'file contents here',
    durationMs: 150,
    ...overrides,
  };
}

describe('ToolCallBlock', () => {
  it('renders tool name in collapsed state', () => {
    render(<ToolCallBlock toolCall={makeToolCall()} />);
    expect(screen.getByText('read_file')).toBeDefined();
  });

  it('shows duration in collapsed header', () => {
    render(<ToolCallBlock toolCall={makeToolCall({ durationMs: 1500 })} />);
    expect(screen.getByText('1.5s')).toBeDefined();
  });

  it('shows ms duration for short operations', () => {
    render(<ToolCallBlock toolCall={makeToolCall({ durationMs: 42 })} />);
    expect(screen.getByText('42ms')).toBeDefined();
  });

  it('renders success status with green border', () => {
    const { container } = render(<ToolCallBlock toolCall={makeToolCall({ status: 'success' })} />);
    const block = container.firstElementChild;
    expect(block?.className).toContain('border-l-success');
  });

  it('renders error status with red border', () => {
    const { container } = render(<ToolCallBlock toolCall={makeToolCall({ status: 'error' })} />);
    const block = container.firstElementChild;
    expect(block?.className).toContain('border-l-destructive');
  });

  it('renders running status with amber border', () => {
    const { container } = render(
      <ToolCallBlock toolCall={makeToolCall({ status: 'running', result: undefined, durationMs: undefined })} />,
    );
    const block = container.firstElementChild;
    expect(block?.className).toContain('border-l-warning');
  });

  it('shows spinning loader for running status', () => {
    render(
      <ToolCallBlock toolCall={makeToolCall({ status: 'running', result: undefined, durationMs: undefined })} />,
    );
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });

  it('does not show input/output when collapsed', () => {
    render(<ToolCallBlock toolCall={makeToolCall()} />);
    // Input/Output labels should not be visible in collapsed state
    expect(screen.queryByText('Input')).toBeNull();
    expect(screen.queryByText('Output')).toBeNull();
  });

  it('shows input and output when expanded', async () => {
    const user = userEvent.setup();
    render(<ToolCallBlock toolCall={makeToolCall()} />);

    // Click to expand
    const trigger = screen.getByRole('button');
    await user.click(trigger);

    expect(screen.getByText('Input')).toBeDefined();
    expect(screen.getByText('Output')).toBeDefined();
  });

  it('formats JSON input prettily when expanded', async () => {
    const user = userEvent.setup();
    render(<ToolCallBlock toolCall={makeToolCall({ input: '{"path":"/tmp/test.ts"}' })} />);

    await user.click(screen.getByRole('button'));

    // Should be pretty-printed
    expect(screen.getByText(/\/tmp\/test\.ts/)).toBeDefined();
  });

  it('does not show output section when result is undefined (running)', async () => {
    const user = userEvent.setup();
    render(
      <ToolCallBlock
        toolCall={makeToolCall({ status: 'running', result: undefined, durationMs: undefined })}
      />,
    );
    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Input')).toBeDefined();
    expect(screen.queryByText('Output')).toBeNull();
  });

  it('does not show duration when undefined', () => {
    render(<ToolCallBlock toolCall={makeToolCall({ durationMs: undefined })} />);
    // No duration text — just the tool name
    expect(screen.getByText('read_file')).toBeDefined();
    expect(screen.queryByText('ms')).toBeNull();
    expect(screen.queryByText(/\ds/)).toBeNull();
  });
});
