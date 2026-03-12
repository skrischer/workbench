// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileDiffViewer } from '../components/file-diff-viewer.js';

// Mock matchMedia for responsive tests
beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

const SAMPLE_DIFF = `diff --git a/src/main.ts b/src/main.ts
index abc1234..def5678 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,4 +1,4 @@
 import { run } from './runner';
-const OLD_VAR = 'hello';
+const NEW_VAR = 'world';

 run();`;

describe('FileDiffViewer', () => {
  it('renders raw text when content is not a diff', () => {
    render(<FileDiffViewer content="just plain text" />);
    expect(screen.getByText('just plain text')).toBeDefined();
  });

  it('parses unified diff and renders line markers', () => {
    const { container } = render(<FileDiffViewer content={SAMPLE_DIFF} />);

    // On desktop view (hidden md:block), should have diff lines
    const desktopView = container.querySelector('.md\\:block');
    expect(desktopView).not.toBeNull();

    // Check for added/removed indicators
    const plusMarkers = desktopView?.querySelectorAll('span');
    const allText = desktopView?.textContent ?? '';
    expect(allText).toContain("const NEW_VAR = 'world';");
    expect(allText).toContain("const OLD_VAR = 'hello';");
  });

  it('shows added lines with success color class', () => {
    const { container } = render(<FileDiffViewer content={SAMPLE_DIFF} />);
    const desktopView = container.querySelector('.md\\:block');
    const addedLines = desktopView?.querySelectorAll('.bg-success\\/10');
    expect(addedLines?.length).toBeGreaterThan(0);
  });

  it('shows removed lines with destructive color class', () => {
    const { container } = render(<FileDiffViewer content={SAMPLE_DIFF} />);
    const desktopView = container.querySelector('.md\\:block');
    const removedLines = desktopView?.querySelectorAll('.bg-destructive\\/10');
    expect(removedLines?.length).toBeGreaterThan(0);
  });

  it('shows mobile raw output', () => {
    const { container } = render(<FileDiffViewer content={SAMPLE_DIFF} />);
    // Mobile view: md:hidden pre
    const mobileView = container.querySelector('.md\\:hidden');
    expect(mobileView).not.toBeNull();
    expect(mobileView?.textContent).toContain(SAMPLE_DIFF);
  });

  it('renders copy button for diff view', () => {
    render(<FileDiffViewer content={SAMPLE_DIFF} />);
    const copyBtn = screen.getByLabelText('Copy diff');
    expect(copyBtn).toBeDefined();
  });

  it('handles diff with no changes gracefully', () => {
    const emptyDiff = `diff --git a/f.ts b/f.ts
--- a/f.ts
+++ b/f.ts
@@ -1,2 +1,2 @@
 line1
 line2`;
    render(<FileDiffViewer content={emptyDiff} />);
    // Should render without error
    expect(screen.getByLabelText('Copy diff')).toBeDefined();
  });

  it('shows line numbers for context lines', () => {
    const { container } = render(<FileDiffViewer content={SAMPLE_DIFF} />);
    const desktopView = container.querySelector('.md\\:block');
    // Context lines should have both old and new line numbers
    const allText = desktopView?.textContent ?? '';
    // Line numbers 1, 2, etc should appear
    expect(allText).toContain('1');
  });
});
