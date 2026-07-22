# FanTakes product vision

## Product promise

FanTakes is the live sports participation network where fans follow the score,
say what they see, defend predictions, build communities, and earn a durable fan
identity.

> Scores bring fans in. Conversations keep them. Identity brings them back.

FanTakes is not a generic sports news reader. The primary unit is participation:
a live game, a take, a prediction, a debate position, a community contribution,
or a reputation event.

## Intended users

1. **Live fan:** wants scores, game context, rapid conversation, and reactions.
2. **Debater:** wants structured positions, evidence, rebuttals, and outcomes.
3. **Predictor:** wants timestamped predictions and an accountable record.
4. **Community member:** wants a persistent home around a team, league, or topic.
5. **Creator:** wants recognizable voice, followers, and reputation.
6. **Moderator:** needs transparent tools to keep participation safe.

## Version 1 goals

- Make live games the fastest path into conversation.
- Make takes readable, attributable, replyable, and reportable.
- Structure debates around explicit positions rather than undifferentiated feeds.
- Give users a persistent profile, prediction history, and reputation summary.
- Support discoverable public communities with membership and moderation.
- Provide reliable notification, search, privacy, and safety controls.
- Deliver a premium black-and-red identity distinct from a news portal.

## Success measures

- Activation: authenticated users who join a game room or publish a take in
  their first session.
- Participation: weekly users who react, reply, predict, or debate.
- Conversation depth: meaningful replies per original take, excluding removed
  content and self-replies.
- Return behavior: users returning for another game within 14 days.
- Identity strength: profiles with team interests plus at least three accountable
  contributions.
- Safety: report acknowledgement time, moderator resolution time, repeat-abuse
  rate, and successful block/mute enforcement.
- Reliability: successful live refreshes, API error rate, and notification lag.

Metrics must never reward harassment, spam volume, or outrage. Ranking uses
quality and relationship signals with rate and abuse controls.

## Product principles

1. **Live context first.** A fan should understand game state before acting.
2. **Conversation over consumption.** Every feed item has a clear participation
   path when permissions allow.
3. **Identity is earned and legible.** Reputation explains its inputs and never
   becomes a purchasable score.
4. **Predictions are accountable.** Lock time and resolution are visible.
5. **Debate is structured.** Positions, replies, evidence links, and moderation
   states remain distinguishable.
6. **Communities have boundaries.** Membership, roles, rules, and enforcement are
   explicit.
7. **Safety is part of interaction design.** Report, block, mute, and appeal are
   first-class workflows.
8. **Premium, not noisy.** Black surfaces, controlled red emphasis, strong type,
   and disciplined density replace generic news-card clutter.

## Existing behavior

- Documentation hierarchy only.
- No executable product behavior exists.

## Required Version 1 functionality

- Public discovery and SEO pages for games, debates, communities, and profiles.
- Authentication, onboarding, sessions, and account recovery.
- Personalized My Arena.
- Games directory and game room with scheduled polling; real-time sockets are
  deferred until load requires them.
- Takes, threaded replies, reactions, predictions, and structured debates.
- Communities, membership, roles, rules, and moderation.
- Search, notifications, preferences, profile, reputation, and Hall of Flame.
- Auditable API, database, analytics, accessibility, testing, and deployment.

## Deferred functionality

- Sportsbook wagering, payments, prizes, and cash-equivalent contests.
- Automated ingestion contracts with a named sports-data vendor.
- Native mobile applications.
- Direct messages, audio rooms, livestream video, and creator monetization.
- Automated toxicity punishment, generative posting, and AI debate judging.
- Federation, third-party developer API, and public webhooks.

## Assumptions and decisions

- The repository is named Sideline; the customer-facing product is FanTakes.
- Version 1 launches web-first with responsive behavior and installable-PWA
  compatibility, not a native application.
- The sports-data provider remains replaceable behind a server adapter; no vendor
  is claimed or required by this specification.
- Predictions are reputation features, not gambling products.
- Reputation is derived from transparent stored events and can be recomputed.
- Public read access is broad; contribution requires an authenticated,
  non-suspended account and any applicable community membership.
- English is the launch language, but storage and UI accept Unicode.
