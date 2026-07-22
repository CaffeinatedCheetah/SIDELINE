# Responsive behavior

## Breakpoints

Design content-first and use Tailwind defaults as implementation anchors:
`sm` 640, `md` 768, `lg` 1024, `xl` 1280 px. Requirements apply continuously,
not only at named breakpoints.

## Layout rules

- Mobile `<768`: one column, 16 px gutters, top header plus bottom navigation,
  sheets instead of centered dialogs where appropriate.
- Tablet `768–1023`: one or two columns according to content, 24 px gutters,
  top navigation, contextual rail moves below primary content if cramped.
- Desktop `>=1024`: persistent top navigation, 32 px gutters, optional 720/320
  content/sidebar grid.
- Wide screens retain 1280 px max width; do not stretch conversation lines.

## Component adaptation

- Tables become labeled card rows; never horizontal-scroll essential controls.
- Tabs may scroll horizontally with visible edge affordance and keyboard access.
- Game cards preserve team/score alignment and move metadata below.
- Composer actions remain visible above the software keyboard and safe area.
- Modal becomes bottom sheet on mobile unless complex content needs a full route.
- Sidebar order follows semantic priority when stacked.

## Input and accessibility

Support mouse, touch, keyboard, zoom to 200%, text spacing overrides, portrait and
landscape. Avoid hover-only content. Use `100dvh` rather than fixed viewport
height for mobile overlays, include safe-area insets, and prevent content from
being hidden behind bottom navigation.

## Test viewports

Required visual/interaction coverage: 320×568, 390×844, 768×1024, 1024×768,
1440×900, plus 200% browser zoom at 1280 CSS-pixel viewport.
