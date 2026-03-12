// @vitest-environment jsdom
// src/web/__tests__/bottom-nav.test.tsx — BottomNav component tests

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BottomNav } from '../components/bottom-nav.js';

describe('BottomNav', () => {
  it('renders all three nav items', () => {
    render(<BottomNav activeView="chat" onViewChange={() => {}} />);

    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('highlights the active tab with primary color', () => {
    render(<BottomNav activeView="sessions" onViewChange={() => {}} />);

    const sessionsButton = screen.getByText('Sessions').closest('button')!;
    const chatButton = screen.getByText('Chat').closest('button')!;

    expect(sessionsButton.className).toContain('text-primary');
    expect(chatButton.className).toContain('text-foreground-muted');
  });

  it('calls onViewChange when a tab is clicked', () => {
    const onViewChange = vi.fn();

    render(<BottomNav activeView="chat" onViewChange={onViewChange} />);

    fireEvent.click(screen.getByText('Sessions'));
    expect(onViewChange).toHaveBeenCalledWith('sessions');

    fireEvent.click(screen.getByText('Settings'));
    expect(onViewChange).toHaveBeenCalledWith('settings');
  });

  it('updates active state when activeView prop changes', () => {
    const { rerender } = render(
      <BottomNav activeView="chat" onViewChange={() => {}} />,
    );

    expect(
      screen.getByText('Chat').closest('button')!.className,
    ).toContain('text-primary');

    rerender(<BottomNav activeView="settings" onViewChange={() => {}} />);

    expect(
      screen.getByText('Settings').closest('button')!.className,
    ).toContain('text-primary');
    expect(
      screen.getByText('Chat').closest('button')!.className,
    ).toContain('text-foreground-muted');
  });

  it('renders as a nav element with md:hidden for mobile-only visibility', () => {
    render(<BottomNav activeView="chat" onViewChange={() => {}} />);

    const nav = screen.getByRole('navigation');
    expect(nav.className).toContain('md:hidden');
  });
});
