# Take Card

## Purpose

Render an attributable fan statement with context, conversation, reputation,
and safety actions.

## Inputs

Take ID/body/status/timestamps, author summary, context label/link, reply depth,
relation kind, reaction counts/current reaction, reply count, viewer permissions,
edited flag, moderation state, and action callbacks.

## Variants and layout

- `feed`: full card with context.
- `thread`: indented by one visual level; deeper replies use a thread line rather
  than progressively shrinking width.
- `compact`: profile/activity summary.
- `tombstone`: removed-content representation preserving thread continuity.

Surface-2, subtle border, `md` radius, 16 px mobile/20 px desktop padding.
Author name uses `label`, body `body`, metadata `caption`; body preserves line
breaks and wraps long tokens. Avatar is 40 px; action icons are 20 px in 44 px
targets.
Typography uses only the shared label, body, and caption tokens.
Colors use semantic surface, text, border, brand, and danger tokens. Spacing is
8 px within metadata/actions, 12 px from identity to body, and 16 px before actions.

## Visible controls

Author/profile link, context link, timestamp permalink, Flame reaction, Reply,
Share, and More menu. More contains Edit/Delete for eligible author and
Report/Mute/Block according to target and permission.

## Interaction and states

Hover changes border only. Focus is per control. Reaction may optimistically
toggle and rolls back with inline/toast error. Reply opens composer and moves
focus. Loading action affects only that action. Disabled reply explains locked,
suspended, blocked, or membership reason. Tombstone exposes no body/actions.
Offline disables mutations and preserves reply drafts.

## Keyboard and screen reader

Card is an `<article>` labeled by author and timestamp, not one giant link.
Reaction exposes pressed state and count. Menus use standard menu keyboard
behavior. Edited text is available. Thread relation and level are conveyed in
text; indentation is not the only signal.

## Responsive behavior

Below 640 px, metadata wraps beneath identity, actions distribute across the
available width, and thread depth uses one fixed 12 px inset plus a labeled line.
Desktop retains the readable 720 px conversation rail.

## Usage and misuse

Use for takes and replies. Do not inject raw HTML, clamp body without an
accessible expand action, hide report behind hover, expose private moderation
notes, or use reaction count as an unlabeled icon.

## Acceptance criteria

Sanitized plain text renders exactly; all permissions and content states are
covered; duplicate mutation is prevented; focus returns after modal actions;
blocked/muted content follows policy; 1,000-character and long-token cases remain
readable; keyboard and screen-reader tests pass.
