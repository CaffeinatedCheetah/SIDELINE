# Public homepage

## Purpose and users

Convert visitors into live participants by leading with current games, active
conversation, and recognizable fan identity. Intended for signed-out visitors
and authenticated fans entering without a specific destination.

## Route, entry, exit, and access

- Route: `/`; public; server-rendered.
- Entry: direct, logo, search engine, campaign, or session return.
- Exit: game room, games, debate, community, profile, Hall of Flame, or sign-in.
- Auth: none to read; contribution actions invoke sign-in with safe return URL.

## Layout and exact section order

1. Global Navbar and skip link.
2. Hero: “Your game. Your take.”, product promise, Explore live games primary
   button, Join FanTakes secondary button, and featured live GameCard.
3. Live Now: horizontal mobile rail / desktop three-card grid, View all games.
4. Trending Takes: ranked TakeCards with visible game/debate context.
5. Debates Worth Entering: up to three debate panels and View all debates.
6. Find Your Crowd: CommunityCards and Browse communities.
7. Fan Identity: explanation plus ProfileCard/Hall of Flame preview and Build
   your profile action.
8. Footer: product links, rules, privacy, terms, accessibility, status.

Desktop uses 1280 px container, asymmetric hero, then 3-column modules. Tablet
uses 2-column hero/cards. Mobile stacks all content, keeps scores above editorial
copy, and uses horizontal snap only for game cards with visible next-card edge.

## Components and interaction

Uses Navbar, Button, GameCard, TakeCard, CommunityCard, ProfileCard, badges,
skeletons, empty/error states, and footer. Shared hover/focus/active/disabled
states follow component contracts. Personalization controls appear only after
auth; signed-out CTA is never disabled. Cards navigate via semantic links.

Loading renders stable hero/list skeletons. Empty live games substitutes “Next
up” scheduled games, never a fake live state. A failed module shows local retry
without taking down other sections. Offline shows cached content with an offline
banner and disables writes. If all discovery calls fail, show product promise,
retry, and direct Games/Debates links.

## Permissions and data/API

Public data: featured games, active takes excluding blocked/private/removed,
open debates, public communities, and eligible reputation leaders. APIs:
`GET /games`, `/takes`, `/debates`, `/communities`, `/hall-of-flame`; server
services may compose these directly. Authenticated filtering applies blocks/mutes.

## Analytics

`home_view`, `home_hero_action`, `home_game_open`, `home_take_open`,
`home_debate_open`, `home_community_open`, `home_identity_action`; dimensions
contain placement and entity ID, never authored text.

## Accessibility and SEO

One H1; sections use H2; rails have labels and keyboard-reachable controls; no
auto-rotation. Metadata includes canonical URL, title/description, Open Graph,
WebSite organization markup, and no fabricated live structured data. Public
content remains meaningful without JavaScript.

## Acceptance criteria and tests

- Score/live content precedes conversation and identity modules.
- Public content renders server-side at 320/768/1440 widths.
- Signed-out protected action returns to exact intended destination after auth.
- Empty/no-live, partial error, total error, loading, stale, and offline states.
- Blocked/private/removed content never appears.
- Keyboard order, landmarks, focus, contrast, reduced motion, axe smoke.
- Canonical/OG metadata and structured data validated.

## Assumptions and decisions

Homepage ordering is editorially fixed in Version 1; algorithmic personalized
module ordering is deferred.
