# Command Palette — Design Overrides

> Overrides `design-system/MASTER.md` for the command palette (desktop only).

## Trigger

- `Cmd/Ctrl + K` keyboard shortcut
- Mobile: not available (use bottom nav instead)

## Layout

```
┌─────────────────────────────────────┐
│  > Search commands...           ⌘K  │
├─────────────────────────────────────┤
│  Sessions                           │
│    New Session                 ⌘N   │
│    Recent: Fix auth bug        ↵    │
│    Recent: Add dark mode       ↵    │
│                                     │
│  Actions                            │
│    Toggle Sidebar              ⌘B   │
│    Abort Run                   ⌘.   │
│    Clear Chat                  ⌘L   │
│                                     │
│  Navigation                         │
│    Settings                    ↵    │
└─────────────────────────────────────┘
```

## Specs

- Width: `min(560px, 90vw)`
- Max height: `min(400px, 70vh)`
- Border radius: `--radius-lg` (8px) — exception to 4px default
- Background: `--card`
- Overlay: `rgba(0, 0, 0, 0.6)` backdrop
- Shadow: `0 25px 50px rgba(0, 0, 0, 0.5)`
- Z-index: 100

## Search Input

- Font: `--font-mono`, 16px
- Placeholder: "Search commands..."
- Auto-focus on open
- Filter results as user types

## Result Items

- Grouped by category (Sessions, Actions, Navigation)
- Category header: `label` size, `--foreground-muted`, uppercase
- Item: `body-sm` size, `--foreground`
- Active item: `--muted` background
- Shortcut hint: right-aligned, `--foreground-muted`, `--font-mono`
- Keyboard nav: arrow keys, Enter to select, Escape to close

## Animations

- Open: fade-in + scale(0.95 → 1.0), `--duration-normal`
- Close: fade-out, `--duration-fast`
