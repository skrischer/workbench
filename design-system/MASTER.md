# Workbench Design System — MASTER

> **Source of Truth** for all UI work across Web and TUI.
> Page-specific overrides in `design-system/pages/<page>.md` take precedence over this file.

---

## 1. Design Identity

| Property | Value |
|---|---|
| Style | **Modern Terminal** — Dark OLED + subtle terminal elements |
| References | Linear, Vercel, Warp Terminal |
| Theme | **Dark-only** (no light mode) |
| Accessibility | WCAG AAA target (7:1 contrast ratio) |
| Performance | Excellent (minimal effects, no heavy animations) |
| Mobile-first | Yes — primary usage on mobile devices |

### Design Principles

1. **Terminal-inspired, not terminal-constrained** — Borrow aesthetics (monospace, glow, dense info) without sacrificing web UX
2. **Information density over decoration** — Every pixel serves a purpose
3. **Mobile-first, desktop-enriched** — Core experience works on 375px; desktop adds panels, shortcuts, diffs
4. **Consistency over creativity** — Follow the token system strictly; deviations require page-override docs

---

## 2. Color System

### Semantic Tokens

```css
:root {
  /* === Backgrounds === */
  --background:         #0F172A;   /* Main app background (Slate 900) */
  --background-deep:    #020617;   /* Deepest layer (Slate 950) */
  --background-elevated: #1E293B;  /* Cards, elevated surfaces (Slate 800) */

  /* === Surfaces === */
  --card:               #1B2336;   /* Card background */
  --card-foreground:    #F8FAFC;   /* Text on cards */
  --muted:              #272F42;   /* Muted backgrounds (inactive, disabled) */
  --muted-foreground:   #94A3B8;   /* Muted text (Slate 400) */

  /* === Primary (Accent) === */
  --primary:            #3B82F6;   /* Electric Blue — CTAs, active states, links */
  --primary-foreground: #FFFFFF;   /* Text on primary */
  --primary-hover:      #2563EB;   /* Primary hover (Blue 600) */
  --primary-glow:       rgba(59, 130, 246, 0.15); /* Subtle glow behind primary elements */

  /* === Semantic Colors === */
  --success:            #22C55E;   /* Green 500 — success, connected, running */
  --success-foreground: #0F172A;
  --warning:            #F59E0B;   /* Amber 500 — warnings, pending */
  --warning-foreground: #0F172A;
  --destructive:        #EF4444;   /* Red 500 — errors, abort, delete */
  --destructive-foreground: #FFFFFF;
  --info:               #06B6D4;   /* Cyan 500 — informational */

  /* === Text === */
  --foreground:         #F8FAFC;   /* Primary text (Slate 50) */
  --foreground-secondary: #CBD5E1; /* Secondary text (Slate 300) */
  --foreground-muted:   #94A3B8;   /* Tertiary/muted text (Slate 400) */

  /* === Borders === */
  --border:             #334155;   /* Default border (Slate 700) */
  --border-subtle:      #1E293B;   /* Subtle separator (Slate 800) */
  --ring:               #3B82F6;   /* Focus ring color */

  /* === Terminal-specific === */
  --terminal-green:     #22C55E;   /* Terminal success/active indicator */
  --terminal-glow:      rgba(34, 197, 94, 0.1); /* Subtle green glow */
  --code-background:    #0D1117;   /* Code block background (GitHub Dark) */
}
```

### Color Usage Rules

| Context | Token | Example |
|---|---|---|
| Page background | `--background` | App shell |
| Card / panel | `--card` | Session panel, chat bubbles |
| Active session | `--primary` + `--primary-glow` | Selected session highlight |
| Running indicator | `--success` | Green dot, spinner |
| Error state | `--destructive` | Failed run, error messages |
| Streaming text | `--foreground` | LLM response text |
| User message | `--primary` (bg) | User chat bubble |
| Assistant message | `--card` (bg) | Assistant chat bubble |
| Tool call block | `--muted` (bg) | Collapsed tool call |
| Code block | `--code-background` | Inline/block code |
| Disabled | `--muted` + `opacity: 0.5` | Disabled buttons/inputs |

### Anti-Patterns

- Never use raw hex values in components — always reference tokens
- Never use `#000000` pure black (causes OLED smearing) — minimum `#020617`
- Never rely on color alone to convey meaning — pair with icons/text
- Never use `--primary` for destructive actions

---

## 3. Typography

### Font Stack

```css
:root {
  --font-mono:  'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  --font-sans:  'IBM Plex Sans', 'Inter', system-ui, -apple-system, sans-serif;
}
```

### Google Fonts Import

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
```

### Tailwind Config

```typescript
fontFamily: {
  mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
  sans: ['IBM Plex Sans', 'Inter', 'system-ui', 'sans-serif'],
}
```

### Type Scale

| Token | Size | Weight | Font | Line Height | Usage |
|---|---|---|---|---|---|
| `display` | 32px | 700 | Mono | 1.2 | Page titles (desktop only) |
| `h1` | 24px | 600 | Mono | 1.3 | Section headings |
| `h2` | 20px | 600 | Mono | 1.3 | Subsection headings |
| `h3` | 16px | 600 | Mono | 1.4 | Card titles, panel headers |
| `body` | 16px | 400 | Sans | 1.6 | Body text, chat messages |
| `body-sm` | 14px | 400 | Sans | 1.5 | Secondary text, descriptions |
| `caption` | 12px | 500 | Sans | 1.4 | Timestamps, metadata, badges |
| `code` | 14px | 400 | Mono | 1.5 | Inline code, code blocks |
| `data` | 14px | 500 | Mono | 1.3 | Token counts, stats, IDs |
| `label` | 12px | 600 | Mono | 1.2 | Labels, status indicators |
| `button` | 14px | 500 | Sans | 1.0 | Button text |

### Typography Rules

- **Headings**: Always `--font-mono` — creates terminal character
- **Body/UI text**: Always `--font-sans` — readability on mobile
- **Code/data**: Always `--font-mono` — technical content
- **Minimum body size**: 16px on mobile (prevents iOS auto-zoom)
- **Line length**: 35-60 chars on mobile, 60-75 chars on desktop
- **No text below 12px** for any purpose
- **Tabular figures**: Use `font-variant-numeric: tabular-nums` for data columns

---

## 4. Spacing & Layout

### Spacing Scale (4px base)

| Token | Value | Usage |
|---|---|---|
| `--space-0` | 0px | — |
| `--space-1` | 4px | Tight gaps (icon-to-text) |
| `--space-2` | 8px | Component internal padding |
| `--space-3` | 12px | Default gap between elements |
| `--space-4` | 16px | Section padding, card padding |
| `--space-5` | 20px | — |
| `--space-6` | 24px | Section separation |
| `--space-8` | 32px | Major section gaps |
| `--space-10` | 40px | Page-level spacing |
| `--space-12` | 48px | Large separations |

### Border Radius

```css
:root {
  --radius-none: 0px;
  --radius-sm:   2px;    /* Badges, small elements */
  --radius-md:   4px;    /* Buttons, inputs, cards — DEFAULT */
  --radius-lg:   8px;    /* Modals, dialogs, command palette */
  --radius-full: 9999px; /* Avatars, status dots */
}
```

**Default**: `--radius-md` (4px) for all interactive elements.

### Breakpoints

| Name | Width | Layout |
|---|---|---|
| `mobile` | < 768px | Single column, bottom nav, drawer |
| `tablet` | 768px – 1023px | Narrow sidebar (200px) + main |
| `desktop` | 1024px – 1439px | Sidebar (280px) + main |
| `wide` | >= 1440px | Sidebar (320px) + main + optional right panel |

### Layout Rules

- **Mobile**: Full-width chat, bottom nav bar, session drawer from left
- **Tablet**: Collapsible narrow sidebar, main content area
- **Desktop**: Persistent sidebar (280px), resizable, main content
- **Wide**: Optional right panel for session details/metadata
- **Safe areas**: Respect `env(safe-area-inset-*)` on mobile
- **Viewport**: Use `min-h-dvh` instead of `100vh` on mobile
- **Max content width**: `max-w-4xl` (896px) for chat messages
- **Z-index scale**: 0 (base) → 10 (sticky) → 20 (dropdown) → 30 (drawer) → 40 (modal) → 50 (toast) → 100 (command palette)

---

## 5. Components

### 5.1 Buttons

| Variant | Background | Text | Border | Hover | Usage |
|---|---|---|---|---|---|
| `primary` | `--primary` | `--primary-foreground` | none | `--primary-hover` + glow | CTAs, send message |
| `secondary` | `--muted` | `--foreground` | none | lighten 10% | Secondary actions |
| `ghost` | transparent | `--foreground-secondary` | none | `--muted` bg | Toolbar buttons, toggles |
| `destructive` | `--destructive` | `--destructive-foreground` | none | darken 10% | Abort, delete |
| `outline` | transparent | `--foreground` | `--border` | `--muted` bg | Alternative actions |

**Size Scale:**

| Size | Height | Padding X | Font Size | Touch Target |
|---|---|---|---|---|
| `sm` | 32px | 12px | 12px | 44x44 (with hitSlop) |
| `md` | 40px | 16px | 14px | 44x44 |
| `lg` | 48px | 24px | 16px | 48x48 |

**Rules:**
- Minimum touch target: 44x44px (use padding/hitSlop if visual size is smaller)
- Loading state: disabled + spinner, no layout shift
- `cursor-pointer` on all clickable elements
- Press feedback: `scale(0.98)` transform, 100ms

### 5.2 Input Fields

```
Height: 44px (mobile) / 40px (desktop)
Background: --background-deep
Border: 1px solid --border
Border (focus): 1px solid --ring + box-shadow: 0 0 0 2px var(--primary-glow)
Border radius: --radius-md (4px)
Font: --font-sans, 16px (prevents iOS zoom)
Placeholder: --foreground-muted
```

### 5.3 Cards / Panels

```
Background: --card
Border: 1px solid --border-subtle
Border radius: --radius-md (4px)
Padding: --space-4 (16px)
```

### 5.4 Chat Bubbles

| Type | Background | Text | Alignment |
|---|---|---|---|
| User | `--primary` | `--primary-foreground` | Right |
| Assistant | `--card` | `--foreground` | Left |
| System | `--muted` | `--foreground-muted` | Center |

### 5.5 Tool Call Block

```
Collapsed:
  Background: --muted
  Left border: 2px solid (status color)
  Content: [icon] tool_name — duration
  Toggle: chevron right/down

Expanded:
  Background: --background-deep
  Input: code block (JSON)
  Output: markdown or text

Status colors:
  Running:  --warning (amber) + spinner
  Success:  --success (green) + check icon
  Error:    --destructive (red) + x icon
```

### 5.6 Status Bar

```
Position: fixed bottom (mobile: above bottom nav)
Background: --background-deep
Border top: 1px solid --border-subtle
Height: 32px
Font: --font-mono, caption size (12px)
Content: Model | Tokens In/Out | Steps | Status
```

### 5.7 Session Panel (Sidebar / Drawer)

```
Background: --background
Border right: 1px solid --border-subtle
Width: 280px (desktop), 200px (tablet), full-width drawer (mobile)

Session Item:
  Padding: --space-3
  Active: background --primary-glow, left border 2px --primary
  Hover: background --muted
  Content: status dot + date + prompt preview (truncated)
```

### 5.8 Bottom Navigation (Mobile)

```
Height: 56px + safe-area-inset-bottom
Background: --background-deep
Border top: 1px solid --border-subtle
Items: max 4 (Chat, Sessions, [future], Settings)
Active: --primary color, rest: --foreground-muted
Touch target: 48x48px per item
Label + Icon required (no icon-only)
```

### 5.9 Command Palette (Desktop)

```
Trigger: Cmd+K / Ctrl+K
Position: centered modal overlay
Width: min(560px, 90vw)
Background: --card
Border: 1px solid --border
Border radius: --radius-lg (8px)
Shadow: 0 25px 50px rgba(0, 0, 0, 0.5)
Z-index: 100

Search input: --font-mono, 16px
Results: grouped by category
Shortcut hints: right-aligned, --foreground-muted
```

### 5.10 Code Blocks

```
Background: --code-background (#0D1117)
Border: 1px solid --border-subtle
Border radius: --radius-md (4px)
Font: --font-mono, 14px
Padding: --space-4
Copy button: top-right, ghost variant, appears on hover
Syntax highlighting: One Dark Pro theme (or similar)
Line numbers: --foreground-muted, right-aligned
```

---

## 6. Effects & Animation

### Terminal Glow (Subtle)

```css
/* Apply sparingly to accent elements only */
.terminal-glow {
  text-shadow: 0 0 10px var(--primary-glow);
}

/* Active status dot */
.status-active {
  box-shadow: 0 0 6px var(--terminal-glow);
}
```

### Animation Tokens

| Token | Duration | Easing | Usage |
|---|---|---|---|
| `--duration-fast` | 100ms | ease-out | Press feedback, opacity |
| `--duration-normal` | 200ms | ease-out | Hover states, small transitions |
| `--duration-slow` | 300ms | ease-in-out | Panel slide, modal open/close |
| `--duration-drawer` | 250ms | cubic-bezier(0.32, 0.72, 0, 1) | Drawer open/close |

### Animation Rules

- **Maximum 300ms** for any micro-interaction
- **Transform + opacity only** — never animate width/height/top/left
- **Respect `prefers-reduced-motion`** — disable all non-essential motion
- **No decorative animation** — every motion must convey state change
- **Exit faster than enter** — exit at ~70% of enter duration
- **Interruptible** — user interaction cancels in-progress animation

---

## 7. Icons

| Property | Value |
|---|---|
| Library | **Lucide React** (`lucide-react`) |
| Default size | 16px (inline), 20px (buttons), 24px (nav) |
| Stroke width | 2px |
| Color | `currentColor` (inherits text color) |
| Style | Outline only (no filled variants) |

### No Emojis

Never use emojis as functional icons. Emojis are acceptable only in user-generated content (chat messages).

Status indicators use Lucide icons:
- Running: `<Loader2 />` (animated spin)
- Success: `<Check />`
- Error: `<X />`
- Warning: `<AlertTriangle />`
- Paused: `<Pause />`

---

## 8. Accessibility

### Contrast Requirements

| Element | Minimum Ratio | Target |
|---|---|---|
| Body text on background | 7:1 | AAA |
| Secondary text on background | 4.5:1 | AA |
| Interactive element borders | 3:1 | AA |
| Icon on background | 3:1 | AA |

### Focus States

```css
/* Visible focus ring for keyboard navigation */
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Never remove focus rings */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Touch Targets

- Minimum: **44x44px** on mobile
- Spacing between targets: minimum **8px**
- Use `hitSlop` or padding when visual size < 44px

### Screen Reader

- All interactive elements need `aria-label` when icon-only
- Status changes use `aria-live="polite"`
- Form errors use `role="alert"`
- Navigation landmarks: `<nav>`, `<main>`, `<aside>`

---

## 9. Responsive Behavior

### Mobile (< 768px)

- Bottom nav bar (4 items max)
- Session list: left drawer overlay
- Chat: full width
- Status bar: above bottom nav
- Input: 44px height, 16px font (no zoom)
- Command palette: fullscreen overlay
- No resizable panels

### Tablet (768px – 1023px)

- Collapsible sidebar (200px)
- Chat: remaining width
- Status bar: bottom
- Command palette: centered modal

### Desktop (>= 1024px)

- Persistent sidebar (280px, resizable)
- Chat: flex-1
- Status bar: bottom
- Command palette: centered modal (560px)
- Keyboard shortcuts active
- File diff viewer available
- Optional right panel for metadata

### Wide (>= 1440px)

- Sidebar (320px, resizable)
- Chat: flex-1 (max-w-4xl centered)
- Optional right panel: session details, token usage, run history

---

## 10. Shared Architecture (TUI ↔ Web)

### Shared (`src/shared/`)

```
src/shared/
├── stores/           # Zustand stores (session, chat, run, ui)
├── hooks/            # Platform-agnostic hooks (useAgentRun, useEventBus)
├── types/            # ChatMessage, SessionPreview, RunState
├── ws-client/        # WebSocket client + reconnect logic
└── constants.ts      # Shared constants, defaults
```

### Platform-specific

```
src/tui/components/   # Ink-specific rendering
src/web/components/   # React DOM + Tailwind rendering
```

### Rules

- Stores must be **renderer-agnostic** (no DOM/Ink imports)
- Hooks can use `useState`, `useEffect` (shared between Ink + React DOM)
- Components are **never shared** — platform-specific by definition
- Types are the **minimum shared contract**

---

## 11. Desktop Enrichments

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + N` | New session |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + P` | Quick session switch |
| `Cmd/Ctrl + L` | Clear chat visually |
| `Cmd/Ctrl + .` | Abort current run |
| `Escape` | Close modal/palette/drawer |

### Resizable Panels

- Sidebar: drag handle on right edge
- Min width: 200px, max: 400px
- Persisted in localStorage
- Collapse threshold: < 100px → auto-collapse

### File Diff Viewer

- Unified diff format (green = added, red = removed)
- Line numbers on both sides
- Copy button per block
- Collapsible within tool-call-block

---

## 12. Pre-Delivery Checklist

### Visual Quality
- [ ] No emojis used as functional icons (Lucide only)
- [ ] All colors use semantic tokens (no raw hex in components)
- [ ] Consistent 4px border-radius on all interactive elements
- [ ] Consistent spacing using 4/8px scale
- [ ] JetBrains Mono for headings/code/data, IBM Plex Sans for body/UI

### Interaction
- [ ] All tappable elements have visible press feedback
- [ ] Touch targets >= 44x44px on mobile
- [ ] Micro-interactions stay within 100-300ms
- [ ] Disabled states use reduced opacity (0.5) + cursor change
- [ ] Loading states show spinner, no layout shift

### Accessibility
- [ ] Primary text contrast >= 7:1 (AAA)
- [ ] Secondary text contrast >= 4.5:1 (AA)
- [ ] Focus rings visible on keyboard navigation
- [ ] `aria-label` on all icon-only buttons
- [ ] `prefers-reduced-motion` respected
- [ ] Form errors announced via `aria-live`

### Responsive
- [ ] Tested at 375px (small phone)
- [ ] Tested at 768px (tablet)
- [ ] Tested at 1024px (desktop)
- [ ] Tested at 1440px (wide)
- [ ] Bottom nav shows correctly with safe areas
- [ ] No horizontal scroll on any breakpoint
- [ ] Input fields use 16px font (no iOS zoom)

### Performance
- [ ] No animation on width/height/top/left
- [ ] Images use WebP/AVIF + lazy loading
- [ ] Lists with 50+ items are virtualized
- [ ] Fonts use `display: swap`
- [ ] Code splitting per route
