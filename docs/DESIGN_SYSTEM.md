# FanTakes design system

## Design direction

FanTakes uses a premium black-and-red sports language: deep neutral surfaces,
high-contrast editorial typography, disciplined red for action/live emphasis,
and compact game information. It must not resemble a generic news homepage with
rows of interchangeable article cards.

## Foundations

- [Colors](design/COLORS.md)
- [Typography](design/TYPOGRAPHY.md)
- [Spacing](design/SPACING.md)
- [Icons](design/ICONS.md)
- [Animations](design/ANIMATIONS.md)
- [Responsive behavior](design/RESPONSIVE.md)

## Required styling architecture

- CSS custom properties define semantic tokens in `app/globals.css`.
- Tailwind configuration maps utilities to tokens; components never use raw hex
  colors or arbitrary spacing when a token exists.
- Dark is the default and only Version 1 theme. High-contrast browser settings
  and forced colors must remain usable. A user-selectable light theme is deferred.
- Component variants use a typed utility such as class-variance-authority and a
  deterministic class merge helper.
- Focus rings are never removed without an accessible replacement.

## Surface hierarchy

1. Canvas: near-black page background.
2. Navigation: opaque black with bottom border.
3. Panel: elevated dark surface for grouped content.
4. Interactive card: panel with hover/focus border change.
5. Overlay: highest surface with scrim and focus containment.

Red means primary action, live state, selected emphasis, or destructive intent
only when paired with explicit text/icon context. It is not used for ordinary
body text or large decorative fields.

## Layout primitives

- `AppShell`: global header/mobile nav and main landmark.
- `PageContainer`: maximum 1280 px, responsive gutters.
- `ContentRail`: 720 px readable conversation column.
- `SidebarRail`: 320 px contextual column.
- `Stack` and `Cluster`: token-based vertical/horizontal composition.
- `VisuallyHidden`, `SkipLink`, `LiveRegion`, and `ErrorSummary` accessibility
  primitives.

## Interaction states

All interactive elements define default, hover, focus-visible, active, disabled,
loading, and error behavior. Hover is enhancement only. Focus uses a 2 px
high-contrast outline with 2 px offset. Active state must differ from hover.
Disabled controls remain legible, expose `disabled`/`aria-disabled`, and explain
why when the reason is not obvious.

## Accessibility specification

- WCAG 2.2 AA contrast and interaction requirements.
- Semantic landmarks and one `<h1>` per page.
- Logical heading order and DOM order matching visual order.
- Minimum 44×44 CSS pixel touch targets, except inline text links with adequate
  line height and spacing.
- No color-only status; live, win/loss, moderation, and validation pair text or
  icon plus accessible label.
- Content remains usable at 320 CSS pixels and 200% zoom.
- Respect `prefers-reduced-motion`; never autoplay sound or video.
- Score changes use a throttled polite live region; countdowns do not announce
  every second.

## Content and tone

Use direct fan language without manufactured outrage. Buttons use verbs. Errors
state what happened and what the user can do. Moderation language is neutral and
specific. Avoid “breaking news” visual tropes unless a game status is genuinely
live.

## Quality rules

- Storybook is optional after the first implementation; component tests are
  required from the start.
- Visual regression covers global shell and critical components at mobile and
  desktop sizes.
- Axe checks run on representative pages; manual keyboard and screen-reader
  checks remain required before release.

## Assumptions and decisions

- Font assets are self-hosted to avoid layout shift and third-party tracking.
- Team colors may appear in small identity accents only; semantic actions always
  use FanTakes tokens.
- User-provided images use fixed aspect ratios and object-fit rules.
