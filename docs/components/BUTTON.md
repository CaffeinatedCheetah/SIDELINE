# Button

## Purpose

Trigger an action or navigate with unmistakable hierarchy and accessible state.

## Props or inputs

`variant`, `size`, `children`, optional leading/trailing icon, `loading`,
`disabled`, `type`, accessible label for icon-only use, and either button event
props or link `href`. A component is never both button and link.

## Variants and sizes

- `primary`: brand fill, white text; one dominant action per region.
- `secondary`: surface-2 fill, strong border, primary text.
- `ghost`: transparent, subtle hover surface.
- `danger`: danger fill for confirmed destructive actions.
- `link`: underlined text for inline navigation.
- `icon`: square ghost control with tooltip.

Sizes: small 32 px high for dense non-touch contexts, medium 40 px visual/44 px
target default, large 48 px, icon 44×44 px.

## Visual specification

Typography uses `label`; horizontal padding is 12/16/20 px by size; icon gap is
8 px. Border is 1 px where applicable, radius `sm`, no default shadow. Leading
icon precedes text; loading spinner replaces the leading icon but preserves width.
Colors use semantic brand, surface, text, danger, and focus tokens. Spacing uses
only the shared scale.

## Interaction

- Hover: primary uses `brand-hover`; secondary/ghost use `surface-3`.
- Focus: 2 px `focus` outline with 2 px offset.
- Active: primary uses `brand-active`; other variants translate 1 px down.
- Disabled: native `disabled` when possible, no events, default cursor, accessible
  contrast; tooltip or adjacent text explains non-obvious reason.
- Loading: disabled against repeat submission, spinner plus unchanged or
  “Saving…” label, `aria-busy=true`.
- Error: error is rendered in the owning form/region, not inside the button.

## Responsive, keyboard, and screen reader

Buttons never shrink below their target. Full-width is an explicit mobile prop,
not automatic. Enter/Space activate native buttons; Enter activates links. Do
not simulate buttons with divs. Icon-only buttons require `aria-label`; loading
status is announced once through the owning live region.

## Usage examples

- Primary “Post take”; secondary “Cancel”; danger “Delete account”; icon-only
  “More actions”.

## Misuse examples

- Multiple primary buttons in one modal.
- Link styled as disabled button without preventing navigation.
- Red button for a neutral filter.
- Icon-only action without accessible name.

## Acceptance criteria

All variants meet contrast, keyboard activation, target size, focus visibility,
loading deduplication, and disabled-event tests. Link and button semantics match
the action, and no layout shift occurs when loading begins.
