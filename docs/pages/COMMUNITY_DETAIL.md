# Community Detail

## Purpose and users

Provide a persistent fan home with identity, rules, membership, scoped discussion,
games, debates, and accountable moderation.

## Route, entry, exit, and access

- Route: `/communities/[slug]`; public in Version 1 and indexable.
- Entry: directory, search, TakeCard attribution, profile, game room.
- Exit: game/debate/take/profile, directory, moderation tools for moderators.

## Layout and exact section order

1. Navbar and breadcrumb.
2. Community hero: banner/accent, avatar, H1, description, member/activity counts,
   Join/Joined, Share, More/Report.
3. Rules summary and View all rules modal.
4. Tabs Feed, Games, Debates, Members, About.
5. Feed composer for members, feed filters, TakeCards, Load more.
6. Tab-specific content.
7. Desktop sidebar: moderators, related communities, safety links.

Desktop hero/full width then 720/320 grid. Tablet stacks sidebar. Mobile uses
compact hero, horizontally scrollable tabs, and composer sheet.

## Interaction and states

Join requires auth and rule acceptance. Members post; moderators get scoped menu
actions. Owner cannot leave until ownership transfer (deferred admin operation).
Shared states apply. Loading preserves hero/feed. Empty feed invites first member
take. Missing/suspended community is safe 404 or explicit unavailable page per
policy. Partial tab failure is local. Offline permits cached reading/drafts only.

## Permissions and data/API

Community GET, membership, takes, games/debates filters, members listing, report,
block/mute. Server enforces active membership for writes, role for moderation,
blocks, content state, and rate limits. Member emails/private settings never load.

## Analytics

`community_view`, `community_tab`, `community_join`, `community_leave`,
`community_take_created`, `community_rules_open`, `community_report`.

## Accessibility and SEO

Banner is decorative; H1/name is text. Tabs semantic and URL-backed. Rules modal
follows shared focus contract. Public canonical metadata, breadcrumb, and
Organization/DiscussionForumPosting only when accurate; unavailable pages noindex.

## Acceptance criteria and tests

- Visitor/member/moderator/owner/suspended states.
- Rule acceptance, join/leave, owner protection, post/report/moderate permission.
- Feed/game/debate/member/about tabs and browser navigation.
- Empty/loading/error/offline/404, blocked/muted filtering.
- Responsive, keyboard, screen reader, SEO.

## Assumptions and decisions

Member directory exposes handle/avatar/role only. Private membership requests,
custom role creation, and ownership transfer UI are deferred.
