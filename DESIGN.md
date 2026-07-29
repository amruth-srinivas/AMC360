# AMC Management & Support Tracking System Design

## Visual Direction

Minimal, professional, information-dense internal tooling with neutral chrome and status-led color.

## Primary Tokens

- Background: `slate-50`
- Surfaces: `white`
- Borders: `slate-200`
- Primary text: `slate-900`
- Secondary text: `slate-500`
- Primary action: `#1F3864`
- Accent: `#2E74B5`

## Status Colors

- Success: `emerald`
- Warning: `amber`
- Critical: `red`
- Info: `blue`
- Neutral: `slate`

## Layout

- Fixed left sidebar plus top bar.
- Compact cards with `rounded-lg`, `border`, and `shadow-sm`.
- Content constrained on form pages and full-width on table/dashboard pages.

## Components

- Use shadcn-style button, card, input, badge, and shell primitives.
- Keep tables dense but calm: no zebra striping, use hover background and borders.
- Prefer right-side create/edit flows in later refinement passes.

## Motion

- 150-250ms transitions only.
- Fade and light vertical shift on route changes.
- Avoid decorative or playful animation.
