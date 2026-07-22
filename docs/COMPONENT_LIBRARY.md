# Component library

## Existing behavior

No components are implemented. The contracts below are required.

## Documented components

- [Button](components/BUTTON.md)
- [Navbar](components/NAVBAR.md)
- [Game card](components/GAME_CARD.md)
- [Take card](components/TAKE_CARD.md)
- [Profile card](components/PROFILE_CARD.md)
- [Community card](components/COMMUNITY_CARD.md)
- [Modals](components/MODALS.md)
- [Forms](components/FORMS.md)

## Required supporting primitives

These do not receive separate files but follow the design-system tokens:

- Avatar: 24/32/40/56/80 px; image or initials; decorative image hidden when
  adjacent text supplies the name.
- Badge: neutral, live, success, warning, danger; text required.
- Tabs: URL-backed where navigational; roving tab index only for true panels.
- Skeleton: mirrors final geometry and is `aria-hidden`.
- EmptyState: icon, heading, explanation, optional single primary action.
- ErrorState: heading, safe message, reference ID, retry when recoverable.
- Toast: transient confirmation only; errors also appear near affected content.
- Menu: button-triggered, keyboard navigable, focus restored on close.
- Pagination: opaque cursor with Previous/Next; infinite lists retain reachable
  landmark and explicit Load more fallback.
- Scoreboard: teams, scores, clock/status, possession/context when available.
- Composer: context, text area, count, attachment/evidence link where permitted,
  cancel, submit, validation, and draft preservation.
- PredictionCard: proposition, outcomes, lock state, selection, distribution,
  and resolution.
- ReputationBadge: label and value with an explanation link; never color alone.

## Composition rules

- Pages import shared components rather than duplicating controls.
- Components receive data and callbacks; they do not fetch unless the component
  is explicitly a server composition boundary.
- Mutation state is owned by the nearest feature container.
- Every list uses stable database identity, never array position.
- Components expose semantic variants, not arbitrary styling props.

## Required quality gates

- Strict prop types and exhaustive variants.
- Keyboard and screen-reader tests for interactive components.
- Loading, empty, error, disabled, and permission behavior.
- 320 px and desktop visual checks.
- No raw color/spacing values outside token definitions.
- No hydration dependency for primary public content.
