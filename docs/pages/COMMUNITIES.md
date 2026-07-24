# Community directory

## Purpose and users

Help fans find public communities organized around teams, leagues, and durable
sports interests. Public visitors browse; authenticated users join.

## Route, entry, exit, and access

- Route: `/communities`; public and indexable.
- Entry: Navbar, Home, Search, game/team context, profile memberships.
- Exit: community detail, team/game, sign-in, create flow when authorized.

## Layout and exact section order

1. Navbar, H1, explanatory text, Find communities search, Create community
   button (initially disabled with eligibility explanation unless enabled).
2. Featured communities.
3. Browse by team/league chips.
4. Tabs Trending, Most active, New; CommunityCard grid.
5. Load more.
6. Community standards callout and footer.

Desktop uses filter rail plus 3-card grid; tablet 2 cards; mobile one card with
filter sheet. Search/filter query is URL-backed.

## Interaction and states

Join confirms rules and requires auth. Leave uses confirmation if the user has a
role. Hover/focus/active/loading follow shared components. Empty filter offers
Clear; no communities offers browse games instead. Errors remain section-local.
Offline shows cached results and disables membership changes.

## Permissions and data/API

`GET /api/v1/communities`, membership POST/DELETE. Only public active communities
appear. Creation UI is deferred until ownership/moderation staffing is approved;
the disabled action must say so or be omitted, never tease an unusable flow.

## Analytics

`communities_view`, `community_filter`, `community_search`, `community_open`,
`community_join`, `community_leave`; do not record search query text.

## Accessibility and SEO

Search has label, results count uses polite live region after submission, chips
are links/buttons with pressed/current state. Canonical defaults, collection
metadata, and breadcrumb structured data. Search/filter URLs noindex when thin.

## Acceptance criteria and tests

- Sort/filter/search URL and pagination behavior.
- Signed-out join return; rules confirmation; join/leave errors.
- Public-only filtering and blocked-community policy.
- Empty/loading/error/offline, 320/768/1440, keyboard/axe, SEO.

## Assumptions and decisions

All Version 1 communities are public. Self-service community creation and private
communities are deferred until moderation capacity exists.
