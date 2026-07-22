# Color system

## Required tokens

| Token | Hex | Use |
|---|---:|---|
| `canvas` | `#080808` | Page background |
| `surface-1` | `#101010` | Navigation and primary panels |
| `surface-2` | `#181818` | Cards, fields, menus |
| `surface-3` | `#222222` | Hovered/elevated surfaces |
| `border-subtle` | `#2E2E2E` | Dividers and card borders |
| `border-strong` | `#484848` | Selected/interactive borders |
| `text-primary` | `#F7F7F7` | Headings and primary copy |
| `text-secondary` | `#B8B8B8` | Supporting copy |
| `text-muted` | `#8A8A8A` | Metadata that still passes AA on its surface |
| `brand` | `#E50914` | Primary action and live emphasis |
| `brand-hover` | `#FF2631` | Hover/focus fill adjustment |
| `brand-active` | `#BC0710` | Pressed state |
| `focus` | `#FFFFFF` | Primary focus outline |
| `success` | `#2FCB78` | Confirmed/success state |
| `warning` | `#F6B73C` | Warning and stale state |
| `danger` | `#FF4D5A` | Error/destructive state |
| `info` | `#4DA3FF` | Neutral informational state |
| `scrim` | `rgba(0,0,0,.72)` | Modal/sheet overlay |

## Rules

- Use semantic CSS variables; never bind product semantics to raw palette names.
- Brand red is limited to primary action, selected/live emphasis, or explicit
  destructive context. Never use red alone to communicate state.
- Links in body copy use `text-primary` plus underline; hover may use brand.
- Team colors occupy at most a 4 px accent, small badge, or data mark and must
  never replace semantic colors.
- Disabled text uses `text-muted` at full opacity on a disabled surface; do not
  reduce opacity below accessible contrast.
- Gradients are permitted only as subtle hero/score ambiance from black to a
  darkened team color; content contrast must remain compliant.

## Accessibility

Verify actual rendered pairs against WCAG 2.2 AA: 4.5:1 normal text, 3:1 large
text and essential UI boundaries. Forced-colors mode must expose system colors,
borders, and focus. High-contrast status always includes text/icon.

## Assumptions and decisions

- Version 1 has one dark theme.
- The listed values are the canonical initial tokens; any adjustment must update
  visual tests and contrast evidence.
