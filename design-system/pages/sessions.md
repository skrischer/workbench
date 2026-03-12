# Sessions Page — Design Overrides

> Overrides `design-system/MASTER.md` for the session panel/list.

## Layout

- **Mobile**: Drawer overlay from left (full height, max 85vw width)
- **Tablet**: Sidebar (200px), collapsible
- **Desktop**: Sidebar (280px), resizable (200-400px range)
- **Wide**: Sidebar (320px)

## Session List Item

```
┌────────────────────────────────┐
│ ● 2h ago                  ⋮   │
│ Fix authentication bug in...   │
│ 1.2k tokens · 3 steps         │
└────────────────────────────────┘
```

- Status dot: left, colored by session status
- Timestamp: top-right, `caption` size, `--foreground-muted`
- Prompt preview: truncated to 2 lines, `body-sm`
- Metadata row: token count + step count, `caption`, `--foreground-muted`
- Active: `--primary-glow` background, `--primary` left border (2px)
- Hover: `--muted` background
- Touch target: full width, minimum 56px height

## Session Search

- Position: top of session panel, sticky
- Input: full width, search icon left, clear button right
- Debounce: 300ms
- No results: "No sessions found" + muted text

## New Session Button

- Position: header of session panel
- Style: `ghost` button with `+` icon
- Mobile: also accessible via bottom nav

## Session Status Dots

| Status | Color | Icon |
|---|---|---|
| Active (running) | `--success` + pulse | `Loader2` (spin) |
| Completed | `--success` | `Check` |
| Paused | `--warning` | `Pause` |
| Failed | `--destructive` | `X` |
| New (empty) | `--foreground-muted` | `Circle` |
