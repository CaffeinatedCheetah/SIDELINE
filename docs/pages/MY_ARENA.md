# My Arena

## Purpose and users

Provide an authenticated fan's personalized return surface for live games,
predictions, conversations, communities, and followed people.

## Route, entry, exit, and access

- Route: `/arena`; authenticated, onboarded, active account; noindex/no-store.
- Entry: profile/mobile menu, post-auth redirect, notification.
- Exit: game, take thread, prediction, debate, community, profile, settings.

## Layout and exact section order

1. Navbar and H1 with short identity/reputation summary.
2. Happening Now: followed/team-interest live GameCards.
3. Your Predictions: open, locked, and recently resolved PredictionCards.
4. Conversations: replies and mentions requiring attention.
5. Your Communities: CommunityCards with unread activity.
6. Following: new takes from followed profiles.
7. Improve Your Arena empty-state controls: teams, follows, communities.

Desktop uses 720/320 grid: primary sections left, reputation and suggestions
right. Tablet stacks sidebar after predictions. Mobile is one column with URL-
backed filter tabs `For you`, `Predictions`, `Replies`, `Communities`.

## Interaction and states

Buttons/cards use shared states. Mark-as-read is explicit per conversation or
bulk action. Predictions are editable only before server lock. Loading uses
section skeletons. Empty sections explain the source and provide one action.
Partial errors remain local. Offline shows cached arena timestamp, disables
writes, and permits cached destination navigation.

## Permissions and data/API

`GET /api/v1/me/arena`, game/prediction detail, notification read, follow and
membership endpoints. Server filters blocks, mutes, removed/private content, and
membership visibility. Another user can never request this aggregate.

## Analytics

`arena_view`, `arena_filter`, `arena_game_open`, `arena_prediction_open`,
`arena_reply_open`, `arena_recommendation_action`; no private content text.

## Accessibility and SEO

Tabs are links because they change URL-filtered views. Section counts have text;
score/reputation changes use restrained live announcements. Page is noindex and
must never expose personalized content in shared caches.

## Acceptance criteria and tests

- Auth redirect and exact no-store headers.
- New-user, no-follows, no-live-games, no-predictions, and populated states.
- Block/mute/community visibility filtering.
- Locked prediction cannot mutate despite stale client.
- Partial failures, offline cache banner, keyboard order, mobile/desktop layout.

## Assumptions and decisions

Version 1 ranking is deterministic: live followed games, direct replies, active
predictions, community recency, then followed-user recency. ML ranking is deferred.
