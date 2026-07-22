# Debate Detail

## Purpose and users

Present a debate's question, explicit positions, arguments, evidence links, and
participation history without collapsing it into a generic comment feed.

## Route, entry, exit, and access

- Route: `/debates/[debateId]`; public read; auth to participate; indexable when
  public and active/archived.
- Entry: Debate Center, game/community, notification, search, shared URL.
- Exit: context, author profile, take permalink, related debate.

## Layout and exact section order

1. Navbar and context breadcrumb.
2. Debate header: H1 prompt, status, creator, open/close times, Share/Report.
3. Position selector/distribution with descriptions and Choose/change position.
4. Debate rules and evidence disclosure.
5. Argument composer for authenticated eligible users.
6. Position tabs plus sort Best/New and relationship filter All/Supports/Challenges.
7. Root TakeCards and threaded replies; Load more.
8. Desktop sidebar: context GameCard/CommunityCard, participants, related debates.

Desktop 720/320 grid; tablet stacks sidebar; mobile uses one column, horizontal
position tabs, sticky Join/Post action, composer sheet.

## Interaction and states

Selecting/changing position requires confirmation and remains auditable. Root
argument requires a current position; reply requires Supports or Challenges.
Evidence link requires label and HTTPS URL and opens safely. Shared hover/focus/
active states apply. Locked debate makes all contribution controls read-only.

Loading skeletons preserve distribution/feed. Empty invites first argument per
position. Missing/private is safe 404. Partial argument error stays local.
Offline retains cached debate and drafts but disables position/post mutations.

## Permissions and data/API

Debate GET, takes GET/POST/reactions, position PUT, report/block/mute. Server
checks active account, debate status/time, context membership, blocks, rate limit,
and content moderation. Evidence is stored as plain label/URL metadata only.

## Analytics

`debate_view`, `debate_position_selected`, `debate_position_changed`,
`debate_argument_created`, `debate_reply_created`, `debate_evidence_open`,
`debate_report`; never prompt/body/evidence URL.

## Accessibility and SEO

Position values are textual; tabs and thread relation are semantic; evidence link
announces external destination. One H1 and ordered headings. Public metadata uses
prompt summary, canonical URL, breadcrumb, and DiscussionForumPosting only when
eligible content accurately maps; removed/private pages noindex.

## Acceptance criteria and tests

- Open/locked/archived, 2–4 positions, zero/large participation.
- Position selection/change confirmation and server race.
- Supports/challenges semantics, evidence URL validation, thread/tombstones.
- Permissions, signed-out return, community restriction, block/mute/report.
- Loading/empty/partial error/offline/404, keyboard, screen reader, SEO.

## Assumptions and decisions

Position history is retained for integrity but only the current selection is
publicly emphasized. Version 1 does not algorithmically declare a winning side.
