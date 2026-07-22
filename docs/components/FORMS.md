# Forms

## Purpose

Collect user input with explicit labels, predictable validation, draft safety,
and accessible submission feedback.

## Inputs and field variants

Form schema, default values, submit state, server field/global errors, labels,
help text, required/optional status, and permissions. Fields: text, textarea,
email, search, select, radio group, checkbox, switch, and file-free avatar URL
selection in Version 1.

## Visual specification

Labels use `label`; inputs use `body`; help/errors use `body-sm`. Fields are 44
px minimum, surface-2, 1 px subtle border, `sm` radius, 12 px horizontal padding.
Textarea minimum is 120 px. Field gap 8 px; group gap 20 px; action gap 12 px.
Leading/trailing icons are 20 px, never replace labels, and reserve 40 px field
space. Colors, typography, spacing, borders, and radii use shared tokens.

## States

Hover strengthens border. Focus uses global ring plus strong border. Filled is
not styled as success. Disabled uses native state and explanation. Read-only is
focusable and visually distinct. Loading prevents duplicate submit but does not
disable fields unless editing would invalidate request. Error uses danger border,
text, `aria-invalid`, and `aria-describedby`. Success is announced and rendered
near the form when navigation does not make it obvious.

## Validation behavior

Validate on submit, then revalidate invalid fields on blur/change. Server remains
authoritative. Focus the error summary, link each error to its field, retain
values, and never clear a form after failure. Character count appears before the
limit and is announced without per-keystroke chatter.

## Responsive, keyboard, screen reader

Single column by default; two-column groups only for short related fields and
collapse on mobile. DOM order matches visual order. Enter submits ordinary
forms but not multiline composer; Space toggles native controls. Every field has
visible label; an input hint is an example, not a label.

## Usage and misuse

Use schema-derived errors and shared controls. Do not validate only by color,
disable paste, auto-advance focus, use unlabeled switches, silently trim meaningful
text, or place destructive and primary actions adjacent without separation.

## Acceptance criteria

Client/server errors match, values survive failure/offline retry, focus and error
summary work, autocomplete attributes are correct, password managers work,
keyboard-only completion succeeds, and forms remain usable at 320 px/200% zoom.
