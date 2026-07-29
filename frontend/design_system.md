# PROMETRIX Design System
**Version:** 1.0 · **Date:** 2026-03-24

---

## 1. Philosophy

> *"The Precision Architect"* — Engineering data visualized as a bespoke technical instrument. No decoration for its own sake. Every element earns its place through function.

**Core rules:**
- **No-Line hierarchy** — boundaries defined by tonal surface shifts, not dividers.
- **Zero gradients** — flat, solid colors only.
- **Typographic precision** — three-font system, each serving a distinct role.
- **Sharper geometry** — minimal border-radius (2px–4px), reinforcing an architectural, physical feel.

---

## 2. Typography

### Font Stack

| Role | Family | Variable | Usage |
|---|---|---|---|
| **Display** | Manrope | `--font-display` | Headings, labels, buttons, navigation |
| **Body** | Inter | `--font-body` | Paragraphs, UI copy, descriptions |
| **Mono** | JetBrains Mono | `--font-mono` | IDs, codes, dates, ref numbers, terminals |

**Google Fonts import:**
```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Manrope:wght@200..800&display=swap');
```

### Type Scale

| Token | Size | Weight | Usage |
|---|---|---|---|
| `text-3xl + font-black` | 30px | 900 | Page titles (H1) |
| `text-2xl + font-bold` | 24px | 700 | Section headings (H2) |
| `text-xl + font-semibold` | 20px | 600 | Card headers (H3) |
| `text-base + font-bold` | 16px | 700 | Table primary values |
| `text-sm + font-medium` | 14px | 500 | Body text, nav labels |
| `text-xs + font-bold` (uppercase) | 12px | 700 | Column headers, tags |
| `text-[11px] + font-black` (uppercase) | 11px | 900 | Status badges, micro-labels |
| `text-[10px]` (monospace) | 10px | 400 | Hash IDs, version numbers |

---

## 3. Color Palette

### Light Theme

| Token | Value | Role |
|---|---|---|
| `--color-surface` | `#f9fafb` | Page background |
| `--color-surface-container-lowest` | `#ffffff` | Component backgrounds |
| `--color-surface-container-low` | `#f3f4f6` | Subtle fills |
| `--color-surface-container` | `#e9ecef` | Elevated surfaces |
| `--color-surface-container-highest` | `#d1d5db` | Borders, dividers |
| `--color-surface-bright` | `#111827` | High-contrast text, headings |
| `--color-on-surface-variant` | `#6b7280` | Secondary text, icons |
| `--color-primary` | `#0284c7` | Brand, CTAs, active indicators |
| `--color-tertiary` | `#059669` | Success, health, active badges |
| `--color-outline-variant` | `rgba(107,114,128,0.15)` | Ghost borders |

### Dark Theme

| Token | Value | Role |
|---|---|---|
| `--color-surface` | `#000000` | Page background (true black) |
| `--color-surface-container-lowest` | `#000000` | Sidebar background |
| `--color-surface-container-low` | `#0a0a0a` | Input backgrounds, subtle fills |
| `--color-surface-container` | `#141414` | Card surfaces |
| `--color-surface-container-highest` | `#222222` | Hover states, elevated UI |
| `--color-surface-bright` | `#f9fafb` | High-contrast text, headings |
| `--color-on-surface-variant` | `#9ca3af` | Secondary text, icons |
| `--color-primary` | `#38bdf8` | Brand, CTAs, active indicators |
| `--color-tertiary` | `#34d399` | Success, health, active badges |
| `--color-outline-variant` | `rgba(255,255,255,0.08)` | Ghost borders |

### Semantic Status Colors

| Status | Background | Text |
|---|---|---|
| Active / Live | `bg-emerald-500/10` | `text-emerald-400` |
| Pending / Warning | `bg-amber-500/10` | `text-amber-400` |
| Critical / Error | `bg-red-500/10` | `text-red-400` |
| Deprecated / Inactive | `bg-zinc-700/40` | `text-zinc-400` |
| Info / Syncing | `bg-sky-500/10` | `text-sky-400` |

---

## 4. Spacing & Sizing Scale

| Use | Value |
|---|---|
| Page padding | `px-8 py-6` |
| Section gap | `space-y-6` |
| Card padding | `px-6 py-5` |
| Table header cell | `px-6 py-4` |
| Table row cell | `px-6 py-5` |
| Sidebar width (expanded) | `280px` |
| Sidebar width (collapsed) | `64px` |
| Header height | `56px` |

---

## 5. Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `2px` | Buttons, tags, inputs, status badges |
| `--radius-md` | `4px` | Cards, table containers, modals |
| `rounded-full` | `9999px` | Avatar bubbles, toggle pills **only** |

---

## 6. Elevation

- Surface elevation is communicated through **background color shifts**, not shadows.
- No decorative drop-shadows unless a floating element (modal, tooltip).
- Table containers may use `shadow-xl` to lift from the page surface.

---

## 7. Component Conventions

### Buttons
- **Primary**: `bg-primary text-black font-black uppercase tracking-wider px-4 py-2 rounded-sm`
- **Ghost**: `border border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60 hover:text-surface-bright rounded-sm`

### Status Badges
```tsx
<span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
  Active
</span>
```

### Table Headers
- Background: `bg-black` (both themes)
- Text: `text-zinc-400 font-black uppercase tracking-[0.15em] text-xs`
- Vertical dividers: `border-r border-outline-variant/20`

### Input Fields
```css
bg-surface-container-low h-10 px-4 rounded-sm text-sm outline-none focus:ring-1 focus:ring-primary/50
```

### Mono Data Elements
All IDs, project numbers, reference numbers, dates, version strings must use `font-mono` (JetBrains Mono).

---

## 8. Icons

Library: **Lucide React**  
- Inline: `w-4 h-4`  
- Action buttons: `w-5 h-5`  
- Default color: `text-on-surface-variant` → `text-primary` on hover.

---

## 9. Animation

Library: **Framer Motion**

| Interaction | Config |
|---|---|
| Page / list mount | `initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{delay: index * 0.04}}` |
| Sidebar collapse | `animate={{width: collapsed ? 64 : 280}}` |
| Sidebar label | `AnimatePresence` with `x: -10` slide + opacity fade |

---

## 10. Sidebar Navigation Structure

```
[Logo / Brand Area]           ← 56px, wordmark only
[Nav Group: Main]
  • Dashboard
  • Projects
  • Analytics
[Nav Group: Administration]
  • Team
  • Settings
[Collapse Toggle]             ← fixed bottom
```
- Active item: left-edge `2px` accent bar in `--color-primary`, `bg-surface-container`.
- Collapsed: icons only, group labels hidden.
