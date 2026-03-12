// src/tui/__tests__/markdown.test.tsx — Markdown component tests

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Markdown } from '../components/markdown.js';

describe('Markdown', () => {
  it('should render plain text', () => {
    const { lastFrame } = render(<Markdown>Hello world</Markdown>);
    expect(lastFrame()).toContain('Hello world');
  });

  it('should render bold text', () => {
    const { lastFrame } = render(<Markdown>**bold text**</Markdown>);
    const output = lastFrame();
    // marked-terminal renders bold with ANSI codes
    expect(output).toContain('bold text');
  });

  it('should render code blocks', () => {
    const { lastFrame } = render(
      <Markdown>{'```js\nconst x = 1;\n```'}</Markdown>
    );
    const output = lastFrame();
    expect(output).toContain('const');
  });

  it('should handle empty content', () => {
    const { lastFrame } = render(<Markdown>{''}</Markdown>);
    expect(lastFrame()).toBeDefined();
  });

  it('should handle incomplete markdown gracefully', () => {
    // During streaming, markdown might be incomplete
    const { lastFrame } = render(<Markdown>{'**incomplete bold'}</Markdown>);
    const output = lastFrame();
    expect(output).toContain('incomplete bold');
  });
});
