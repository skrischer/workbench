// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarkdownRenderer, StreamingCursor } from '../components/markdown-renderer.js';

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined);
beforeEach(() => {
  mockWriteText.mockClear();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mockWriteText },
    writable: true,
    configurable: true,
  });
});

describe('MarkdownRenderer', () => {
  it('renders plain text', () => {
    render(<MarkdownRenderer content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('renders inline code', () => {
    render(<MarkdownRenderer content="Use `console.log`" />);
    const code = screen.getByText('console.log');
    expect(code.tagName).toBe('CODE');
    expect(code.className).toContain('bg-muted');
  });

  it('renders fenced code blocks with language label', () => {
    const md = '```javascript\nconst x = 1;\n```';
    const { container } = render(<MarkdownRenderer content={md} />);
    expect(screen.getByText('javascript')).toBeDefined();
    // Syntax highlighter tokenizes code into spans, use textContent
    const codeBlock = container.querySelector('code');
    expect(codeBlock?.textContent).toContain('const');
    expect(codeBlock?.textContent).toContain('x');
    expect(codeBlock?.textContent).toContain('1');
  });

  it('renders code block copy button on hover', () => {
    const md = '```js\nconst a = 1;\n```';
    render(<MarkdownRenderer content={md} />);
    const copyBtn = screen.getByLabelText('Copy code');
    expect(copyBtn).toBeDefined();
  });

  it('copies code to clipboard when copy button clicked', async () => {
    const md = '```js\nconst a = 1;\n```';
    render(<MarkdownRenderer content={md} />);
    const copyBtn = screen.getByLabelText('Copy code');
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('const a = 1;');
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Copied')).toBeDefined();
    });
  });

  it('renders GFM tables', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    render(<MarkdownRenderer content={md} />);
    expect(screen.getByText('A')).toBeDefined();
    expect(screen.getByText('B')).toBeDefined();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('renders GFM strikethrough', () => {
    render(<MarkdownRenderer content="~~deleted~~" />);
    const del = screen.getByText('deleted');
    expect(del.tagName).toBe('DEL');
  });

  it('renders links with primary color', () => {
    render(<MarkdownRenderer content="[Link](https://example.com)" />);
    const link = screen.getByText('Link') as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.href).toBe('https://example.com/');
    expect(link.target).toBe('_blank');
    expect(link.className).toContain('text-primary');
  });

  it('renders headings', () => {
    render(<MarkdownRenderer content="# Title" />);
    const h1 = screen.getByText('Title');
    expect(h1.tagName).toBe('H1');
  });

  it('renders blockquotes', () => {
    render(<MarkdownRenderer content="> Quote text" />);
    const bq = screen.getByText('Quote text');
    expect(bq.closest('blockquote')).toBeDefined();
  });

  it('shows streaming cursor when isStreaming', () => {
    render(<MarkdownRenderer content="Typing..." isStreaming />);
    const cursor = document.querySelector('.animate-cursor-blink');
    expect(cursor).not.toBeNull();
  });

  it('does not show streaming cursor when not streaming', () => {
    render(<MarkdownRenderer content="Done" />);
    const cursor = document.querySelector('.animate-cursor-blink');
    expect(cursor).toBeNull();
  });

  it('renders unordered lists', () => {
    const md = `- Item A
- Item B`;
    render(<MarkdownRenderer content={md} />);
    expect(screen.getByText('Item A')).toBeDefined();
    expect(screen.getByText('Item B')).toBeDefined();
  });

  it('renders ordered lists', () => {
    const md = `1. First
2. Second`;
    render(<MarkdownRenderer content={md} />);
    expect(screen.getByText('First')).toBeDefined();
    expect(screen.getByText('Second')).toBeDefined();
  });
});

describe('StreamingCursor', () => {
  it('renders a blinking block cursor', () => {
    render(<StreamingCursor />);
    const cursor = document.querySelector('.animate-cursor-blink');
    expect(cursor).not.toBeNull();
    expect(cursor?.getAttribute('aria-hidden')).toBe('true');
  });
});
