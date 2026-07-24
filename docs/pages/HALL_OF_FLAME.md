# Hall of Flame

## Purpose and users

Celebrate accountable fan participation without rewarding spam or outrage.
Public users browse; authenticated users can open profiles and eligible content.

## Route, entry, exit, and access

- Route: `/hall-of-flame`; public and indexable.
- Entry: Navbar, Home identity module, profile badge.
- Exit: profile, prediction, take, debate, game, reputation explanation.

## Layout and exact section order

1. Navbar, H1, explanation and How ranking works.
2. Period selector Week, Season, All time.
3. Category tabs Predictors, Debaters, Community builders.
4. Top three featured ProfileCards with rank and evidence summary.
5. Ranked list 4–50 with transparent metric and sample size.
6. Eligibility/safety explanation and footer.

Desktop uses podium-like top-three grid without inaccessible vertical ranking;
tablet 3 cards; mobile ordered list. Category/period are URL-backed.

## Interaction and states

Hover/focus links use shared components. No voting or purchasing rank. Loading
uses fixed rank rows. Empty states explain insufficient eligible activity. Error
offers retry. Offline shows cached ranking with generated timestamp.

## Permissions and data/API

`GET /api/v1/hall-of-flame?period&category`. Eligible users are active/public,
not currently sanctioned, have minimum sample size, and derive rank from versioned
reputation events. Ties share metric but stable order uses internal ID only to
render deterministically, not imply superiority.

## Analytics

`hall_view`, `hall_period`, `hall_category`, `hall_profile_open`,
`hall_methodology_open`.

## Accessibility and SEO

Rank is visible text and ordered-list semantics; color/flame icon is decorative.
Metrics include units and explanations. Canonical URL for default; index approved
period/category pages only. ItemList structured data uses public profiles.

## Acceptance criteria and tests

- Each category/period, ties, minimum sample, removed/suspended exclusion.
- Stable ordering and reproducible calculation fixture.
- Empty/loading/error/offline/stale timestamp.
- 320/768/1440, ordered-list semantics, keyboard, SEO.

## Assumptions and decisions

Version 1 rankings recompute on a scheduled job and display “updated” time. The
formula is transparent and versioned; prizes and monetization are deferred.
