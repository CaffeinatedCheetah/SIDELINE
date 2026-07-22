# Game Room

## Purpose and users

Combine authoritative game context with live fan conversation, predictions, and
community identity. Public users read; authenticated fans participate.

## Route, entry, exit, and access

- Route: `/games/[gameId]`; public read and conditionally indexable.
- Entry: GameCard, search, notification, shared URL.
- Exit: team/community, author profile, take permalink, debate, games directory.

## Layout and exact section order

1. Navbar and breadcrumb back to Games/league.
2. Scoreboard hero: teams, status, score, clock/period, start/final time, stale
   indicator, Follow and Share.
3. Participation bar: Post take, Make prediction, Start debate (permission-aware).
4. Prediction module: active propositions, lock countdown, selection/distribution.
5. Conversation header: sort Hot/New, context filters All/Takes/Predictions.
6. Composer when opened.
7. TakeCard feed and Load more.
8. Desktop sidebar: game facts, related community, active debate, room rules.
9. Related games and footer.

Desktop uses scoreboard full width and 720/320 grid. Tablet stacks sidebar after
feed. Mobile uses compact scoreboard, sticky participation bar above bottom nav,
one-column feed, and bottom-sheet composer.

## Interactions and states

Poll every 15 seconds visible/60 background and stop at final. Highlight score
change without reordering focused content. Reaction may be optimistic; take
creation waits for server. Sort/filter use URL. Hover/focus/active/disabled follow
shared components. Prediction disables at server lock even if client clock lags.

Loading shows scoreboard/feed skeletons. Missing game is 404. Upstream score
failure retains last snapshot and timestamp. Empty conversation invites first
take. Partial prediction/feed failures remain local. Offline retains cached score
and feed, marks timestamp, preserves drafts, disables writes.

## Permissions and data/API

Game GET/ETag, takes GET/POST/reactions, predictions GET/entry PUT, follow PUT/
DELETE, debates GET. Server enforces active account, blocks/mutes, suspension,
game/debate locks, and moderation status. Starting debate may be rate-limited.

## Analytics

`game_room_view`, `score_refresh_result`, `game_follow`, `take_composer_open`,
`take_created`, `reaction_changed`, `prediction_selected`, `debate_start`; never
include take body or chosen evidence URL.

## Accessibility and SEO

Scoreboard is a labeled region; changes announce a throttled complete score.
Countdown announces key thresholds only. Sticky controls do not cover content.
SportsEvent metadata and canonical URL use verified public data; canceled/private
provider placeholders are noindex.

## Acceptance criteria and tests

- Scheduled/live/final/postponed/canceled and score-correction states.
- Poll visibility/backoff/ETag and no focus/feed jump.
- Signed-out, suspended, blocked, rate-limited, prediction lock races.
- Create/reply/react/report/block flows and draft retention.
- Loading/empty/partial error/offline/404 at all responsive sizes.
- Keyboard composer/menu, screen-reader score update, SEO validation.

## Assumptions and decisions

Polling is Version 1 live transport. Play-by-play is shown only if the provider
adapter supplies verified data; it is not synthesized.
