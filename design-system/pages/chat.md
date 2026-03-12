# Chat Page — Design Overrides

> Overrides `design-system/MASTER.md` for the main chat view.

## Layout

- **Mobile**: Full-width, input fixed bottom (above bottom nav), messages scroll
- **Desktop**: Centered content (max-w-4xl), sidebar visible left

## Message List

- Auto-scroll to bottom on new message
- Scroll-to-bottom FAB when user scrolls up (ghost button, bottom-right)
- Streaming text renders incrementally (no layout jump)
- Messages grouped by run (visual separator between runs)

## Chat Input

- **Mobile**: 44px height, full-width, send button right
- **Desktop**: 40px height, max-w-4xl, supports multi-line (Shift+Enter)
- Slash command prefix `/` triggers autocomplete dropdown above input
- Disabled during active run (muted background, "Running..." placeholder)

## Tool Call Blocks

- Inline between messages (not separate section)
- Default: collapsed (one-liner)
- Status-colored left border (2px):
  - Running: `--warning` (amber)
  - Success: `--success` (green)
  - Error: `--destructive` (red)
- Click to expand: shows input JSON + output text/markdown
- File operations: show diff viewer instead of raw output (desktop only)

## Streaming Indicator

- Blinking cursor (▊) at end of streaming text
- Pulse animation: opacity 0.3 → 1.0, 500ms interval
- Respects `prefers-reduced-motion` (solid cursor, no blink)

## Markdown Rendering

- GitHub-flavored markdown (tables, strikethrough, task lists)
- Code blocks: `--code-background`, One Dark syntax theme, copy button
- Inline code: `--muted` background, `--font-mono`
- Links: `--primary` color, underline on hover
- Images: max-width 100%, border-radius 4px
- Tables: border `--border-subtle`, header `--muted` background
