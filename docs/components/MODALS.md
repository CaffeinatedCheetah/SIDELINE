# Modals and sheets

## Purpose

Interrupt only for focused confirmation, short creation, or required disclosure
while preserving context and accessibility.

## Inputs and variants

Open state, title, description, content, primary/secondary actions, destructive
flag, close permission, initial focus target, busy/error state, and completion
callback. Variants: `dialog` (max 480 px), `wide` (720 px), `alert` for destructive
confirmation, and mobile `sheet`.

## Visual specification

Surface-2, strong border, `lg` radius, overlay shadow, 24 px desktop/20 px mobile
padding, 16–24 px section gaps. Scrim uses token. Title heading-2; body uses body.
Actions align right desktop and stack full-width mobile.
Typography, colors, spacing, borders, and radii use shared semantic tokens;
danger color appears only on the destructive confirmation action.

## Interaction

Opening stores trigger and moves focus to heading or safest action. Tab is trapped;
Escape and scrim close only when allowed and not busy. Close restores trigger.
Destructive alert focuses Cancel. Loading disables dismissal that would corrupt
state and announces progress. Error appears in an error summary and moves focus.
Disabled actions remain labeled and expose the unmet validation or permission
reason.

## Responsive, keyboard, screen reader

Below 640 px, ordinary dialog becomes bottom sheet using safe-area padding and
`100dvh` maximum; complex workflows use a page instead. Use native dialog
semantics or proven accessible primitive with `aria-labelledby` and optional
`aria-describedby`. Background is inert.

## Usage and misuse

Use for report, delete confirmation, compact composer, and rule acceptance. Do
not nest modals, show long settings/forms, rely on browser confirm, auto-open
marketing, or hide a required decision behind an icon-only close.

## Acceptance criteria

Focus containment/restoration, Escape rules, background inertness, mobile sheet,
loading/error, reduced motion, scroll lock, and destructive safe-focus behavior
pass automated and manual tests.
