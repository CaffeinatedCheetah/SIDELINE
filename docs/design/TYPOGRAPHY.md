# Typography

## Font families

- Display/headlines: self-hosted `Barlow Condensed`, fallback `Arial Narrow`,
  `Arial`, sans-serif.
- UI/body: self-hosted `Inter`, fallback system-ui, `Segoe UI`, sans-serif.
- Scores/tabular data: Inter with `font-variant-numeric: tabular-nums`.

## Type tokens

| Token | Size/line | Weight | Use |
|---|---|---:|---|
| `display-xl` | 56/56 | 800 | Desktop marketing hero only |
| `display-lg` | 40/44 | 800 | Page hero/title |
| `heading-1` | 32/38 | 750 | Page H1 |
| `heading-2` | 24/30 | 700 | Major sections |
| `heading-3` | 20/26 | 700 | Cards/subsections |
| `body-lg` | 18/28 | 450 | Introductory copy |
| `body` | 16/24 | 450 | Default content |
| `body-sm` | 14/20 | 450 | Metadata/supporting UI |
| `label` | 13/16 | 650 | Controls, tabs, badges |
| `caption` | 12/16 | 550 | Timestamps and compact metadata |

Display text may use uppercase with 0.02em tracking only for short labels or
scores, never paragraphs. Body copy remains sentence case. Minimum interactive
text is 14 px; legal/supporting copy is at least 12 px and passes contrast.

## Responsive behavior

At widths below 768 px, `display-xl` becomes 40/42, `display-lg` becomes 34/38,
and `heading-1` becomes 28/34. Body sizes do not shrink. Text containers use
`max-width: 68ch`; conversation content uses 62ch.

## Accessibility and loading

Self-host WOFF2, preload only the primary UI regular face, use `font-display:
swap`, and provide metric-compatible fallbacks to minimize layout shift. Never
encode information solely through weight, italics, or capitalization.
