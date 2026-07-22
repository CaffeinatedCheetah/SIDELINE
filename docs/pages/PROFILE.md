# Profile

## Purpose and users

Make fan identity durable through public interests, accountable participation,
prediction record, communities, and explainable reputation.

## Route, entry, exit, and access

- Route: `/users/[handle]`; public unless deleted/restricted; indexable when public.
- Entry: TakeCard/ProfileCard, search, leaderboard, community, own nav.
- Exit: take/debate/game/community, followers/following, settings for owner.

## Layout and exact section order

1. Navbar.
2. Profile header: avatar, display name, `@handle`, bio, favorite teams, Follow,
   Share, More, Edit profile for owner.
3. Reputation summary: level/value, prediction accuracy with sample size,
   contribution badges, How reputation works.
4. Tabs Takes, Predictions, Debates, Communities, About.
5. Filtered content list and Load more.
6. Desktop sidebar: notable badges, following/follower counts, joined date.

Desktop 720/320; tablet stacks; mobile centers identity, wraps actions, URL-backed
scrolling tabs, one-column content.

## Interaction and states

Follow may optimistically update; block confirms and immediately hides interaction.
Owner edit opens page/modal using Forms. Shared states apply. Empty tab has
identity-specific action for owner and neutral message for visitor. Restricted/
deleted/block relationship uses privacy-safe surface. Offline permits cached read
and disables follow/edit.

## Permissions and data/API

User GET, takes/debates/predictions/communities collections, follow, block/mute,
report, own profile PATCH. Reputation derives from events and displays method;
private email/settings/moderation notes never appear. Predictions show resolved
record and locked pending entries, not active private choice before lock if policy
requires concealment.

## Analytics

`profile_view`, `profile_tab`, `profile_follow`, `profile_block`,
`profile_report`, `profile_edit_open`; no handle in analytics payload if internal
user ID is available.

## Accessibility and SEO

Avatar alt is empty beside name. Reputation has text explanation and sample size.
Tabs/menus work by keyboard. Public profiles have canonical URL, Person/ProfilePage
structured data with public fields only; restricted/deleted profiles noindex.

## Acceptance criteria and tests

- Owner/visitor/following/self/block/mute/restricted/deleted states.
- Long Unicode name/bio, absent avatar/teams, reputation zero/small sample.
- Each tab, pagination, loading/error/offline/empty.
- Edit validation, unique handle conflict, focus restoration.
- Privacy field exclusion, responsive/keyboard/axe/SEO.

## Assumptions and decisions

Follower lists are public for active public profiles but respect blocks. Reputation
formula is documented and versioned; paid boosts and opaque scores are prohibited.
