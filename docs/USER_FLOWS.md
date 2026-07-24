# User flows

## Existing behavior

No flows are implemented. These are required Version 1 contracts.

## 1. Discover and join a live game

1. User enters `/`, `/games`, search, or a shared game URL.
2. Game card shows teams, score/status, start time, and conversation count.
3. User opens `/games/[gameId]`; the room loads score before the conversation.
4. Signed-out user may read and is prompted to sign in when attempting to react,
   publish, predict, or follow.
5. Authenticated user joins the room implicitly by participating or explicitly
   follows the game.
6. Success: action is persisted, announced accessibly, and reflected in My Arena.
7. Failure: retain composed text, explain the failure, and offer retry.

## 2. Authenticate and onboard

1. Protected action preserves a same-origin `returnTo` URL.
2. User chooses Google or email magic link.
3. Server validates redirect, rate limits attempts, and sends or completes auth.
4. New user selects unique handle, display name, optional avatar, favorite teams,
   and accepts terms/community rules.
5. Success returns to original intent; cancellation returns without action.
6. Suspended users can sign in only to view enforcement and appeal information.

## 3. Publish a take or reply

1. User selects Create Take or Reply.
2. Composer identifies context and remaining character count.
3. Client and server validate 1–1,000 Unicode characters; whitespace-only fails.
4. Submission disables duplicate action while in flight.
5. Server verifies account/community permission and persists content plus event.
6. Success inserts the canonical response and focuses it.
7. Error retains the draft locally until success, explicit discard, or sign-out.

## 4. Make a prediction

1. User opens a game prediction card before `locksAt`.
2. User selects exactly one allowed outcome and confirms.
3. API records server time and immutable selected option.
4. User may change the choice until lock; each change is audited.
5. After lock, controls become read-only. Resolution is performed from trusted
   game outcome data or an administrator operation.
6. Reputation events are generated idempotently after resolution.

## 5. Participate in a debate

1. User opens debate detail and reads question, rules, and positions.
2. User chooses a position before creating a root argument.
3. Replies may support or challenge and must identify their relationship.
4. Evidence is represented as safe external links with labels, not uploaded files.
5. Position changes remain visible in audit history but only current position is
   emphasized.

## 6. Join and participate in a community

1. User finds a community via directory, search, or content attribution.
2. Public community can be viewed before joining; inactive or unavailable
   communities reveal no member or content data.
3. Join is immediate for public communities; private membership is deferred.
4. Contribution checks membership, rules acknowledgement, and account status.
5. Leaving preserves authored content unless deleted under policy.

## 7. Report, block, or mute

1. Overflow menu exposes Report and, where applicable, Mute/Block.
2. Report requires a reason and optional detail; submission is confidential.
3. Block immediately removes mutual interaction surfaces and hides content by
   default; mute hides target content without notifying the target.
4. Moderator queue records assignment, decision, reason, and audit event.
5. Reporter sees receipt and status, never private moderator notes.

## 8. Manage identity and settings

1. User opens profile or settings.
2. Profile edits validate handle/display data and preview public effect.
3. Privacy and notification preferences save independently.
4. Sensitive changes require recent authentication.
5. Account deletion starts a reversible 14-day pending-deletion period, signs
   out sessions, and documents content-retention consequences.

## Shared state behavior

- Loading: show stable skeletons, never fake data.
- Empty: explain why empty and provide one relevant action.
- Error: preserve user input, provide retry, and expose support reference ID.
- Offline: read cached shell if available; disable writes with an offline label.
- Permission denied: explain the required status without exposing private data.
- Optimistic UI: reactions/follows only; authored content waits for server receipt.

## Analytics convention

Events contain `event_name`, anonymous/session user key, page, entity type/id,
source surface, timestamp, and experiment key when approved. Never include take
text, email, report detail, search query, or sensitive profile data. Required
events are named in each page specification.

## Assumptions and decisions

- Draft preservation uses local browser storage scoped to user and context, and
  is cleared on publish, explicit discard, or sign-out.
- Version 1 community membership is public and immediate; invitation/private
  workflows are deferred.
- Live score freshness uses polling, not a promised websocket integration.
