# Profile Card

## Purpose

Show a fan's recognizable identity, interests, reputation, and relationship action.

## Inputs

Handle, display name, avatar, bio excerpt, favorite teams, reputation summary,
badges, follow state, viewer relationship, privacy/status, and profile URL.

## Variants and sizes

`compact` for lists (56 px avatar), `standard` for recommendations (64 px), and
`featured` for leaderboard placement (80 px). Typography uses heading-3/name,
body-sm/handle and bio, label/reputation. Surface-2, subtle border, `md` radius,
16–20 px padding.
Spacing is 12 px between avatar and identity, 8 px within metadata, and 16 px
before actions. Team, reputation, menu, block, and report icons use approved
mapping and 44 px targets.

## Controls and states

Name/avatar link to profile; Follow/Following button is separate; More offers
mute/block/report where allowed. Hover strengthens border; focus is per control;
active follow exposes pressed state. Loading preserves card geometry. Missing
avatar uses initials. Restricted/deleted profiles show policy-safe empty state.
Offline allows navigation to cached profile but disables relationship mutations.
Disabled relationship controls state the self, block, suspension, or offline
reason.

## Responsive and accessibility

Compact cards stack the follow action below identity below 360 px. Team marks
include visible names or accessible labels. Reputation has text explanation and
is never color-only. Truncated bio has an accessible profile link, not a hidden
tooltip dependency.
Screen reader behavior exposes name, handle, reputation label/value, and
relationship state once while hiding decorative marks.

## Usage and misuse

Use for search, recommendations, followers, and Hall of Flame. Do not expose
email, private preferences, exact moderation state, or a contextless numeric
reputation score.

## Acceptance criteria

Relationship permissions, self-profile state, blocked state, long names, absent
media, loading/error, keyboard actions, and responsive wrapping are directly
tested.
