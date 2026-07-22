# Database schema

## Existing behavior

No database, ORM, migration, or seed code exists.

## Required platform

PostgreSQL with Prisma. IDs are UUIDs generated server-side. Every mutable table
has `created_at` and `updated_at` in UTC. Soft deletion is used only where thread
integrity, moderation, or legal retention requires it; otherwise delete.

## Core entities

| Entity | Required fields and constraints |
|---|---|
| `User` | `id`, unique normalized `email`, unique normalized `handle`, `display_name`, optional `bio/avatar_url`, `role`, `status`, `onboarded_at`, timestamps |
| `Account` / `Session` / `VerificationToken` | Auth.js-compatible provider identity, expiring sessions/tokens, unique provider account |
| `UserPreference` | one-to-one user; timezone, reduced-data preference, notification and privacy JSON validated through typed service |
| `Sport` | unique `key`, name, active |
| `League` | sport FK, unique provider-neutral `key`, name, abbreviation |
| `Team` | league FK, unique key, name, abbreviation, optional safe logo URL and colors |
| `Game` | league FK, home/away team FKs, scheduled/start/end UTC, status, scores, period/clock snapshot, provider reference, version |
| `GameFollow` | unique user/game, notification preference, timestamps |
| `Take` | author FK, optional game/debate/community/parent FKs, body, relation kind for debate replies, status, edited_at, timestamps |
| `TakeReaction` | unique user/take/reaction kind; timestamps |
| `Prediction` | game FK, proposition, options JSON validated by service, `locks_at`, resolution status/value |
| `PredictionEntry` | unique user/prediction, selected option, submitted/updated timestamps, resolved result |
| `Debate` | creator FK, title, prompt, slug/opaque ID, status, optional game/community FK, opens/closes timestamps |
| `DebatePosition` | debate FK, stable key, title, description, display order; unique debate/key |
| `DebateMembership` | unique user/debate, current position FK, joined/changed timestamps |
| `Community` | owner FK, unique slug, name, description, visibility, avatar/banner, rules, status |
| `CommunityMember` | unique user/community, role, status, rules accepted timestamp |
| `Follow` | unique follower/followed user; self-follow prohibited |
| `Block` | unique blocker/blocked user; self-block prohibited |
| `Mute` | unique user/target plus target type/id; validated polymorphic target |
| `Notification` | recipient FK, actor FK optional, type, entity type/id, read_at, created_at; immutable payload snapshot limited to display-safe fields |
| `Report` | reporter FK, target type/id, reason, detail, state, assigned moderator, resolution, timestamps |
| `ModerationAction` | moderator FK, target, action, reason, expiry, report FK optional, created_at; append-only |
| `ReputationEvent` | user FK, source type/id, event type, points, occurred_at; unique idempotency key; append-only |
| `AnalyticsEvent` | pseudonymous actor/session, event name, safe dimensions, occurred_at; no authored text or sensitive data |

## Enums

- User role: `USER`, `MODERATOR`, `ADMIN`.
- User status: `ACTIVE`, `SUSPENDED`, `PENDING_DELETION`, `DELETED`.
- Game status: `SCHEDULED`, `LIVE`, `FINAL`, `POSTPONED`, `CANCELED`.
- Content status: `ACTIVE`, `AUTHOR_REMOVED`, `MODERATOR_REMOVED`.
- Community visibility: `PUBLIC`; `PRIVATE` is reserved and deferred.
- Membership role: `MEMBER`, `MODERATOR`, `OWNER`.
- Debate status: `DRAFT`, `OPEN`, `LOCKED`, `ARCHIVED`.
- Report state: `OPEN`, `IN_REVIEW`, `RESOLVED`, `DISMISSED`, `APPEALED`.

## Indexes

- Game: `(status, scheduled_at)`, league/date, each team/date.
- Take: context plus descending creation, author plus descending creation,
  parent plus ascending creation; partial active-content indexes.
- Debate/community/profile: unique slug or normalized handle plus public status.
- Notification: recipient with unread/descending creation.
- Report: state/created, assignee/state.
- Reputation: user/occurred and unique idempotency key.
- PostgreSQL full-text indexes for approved searchable fields; authored content
  search may be added after privacy/moderation review.

## Integrity and authorization

- Context FKs do not alone grant visibility; every query applies service-level
  authorization.
- A take has at most one root context among game/debate/community unless it is a
  reply inheriting parent context; enforce with a check constraint and service.
- Score/provider updates use optimistic `version` comparison.
- Reputation total is a derived query/materialized value, never directly edited.
- Moderation actions and reputation events are append-only to application roles.

## Retention and privacy

- Expired sessions/tokens: delete on schedule.
- Analytics raw events: 90 days, then aggregate or delete.
- Reports/audit actions: retain according to published safety/legal policy.
- Pending account deletion: 14 days; then remove personal fields and preserve
  attributed content only under the disclosed retention policy.
- Never store OAuth tokens unencrypted; avoid retaining them when not required.

## Migration and seed policy

- Every schema change uses a reviewed forward migration.
- Production deploy runs migrations once in a controlled job.
- Seed data is deterministic and development/test-only: sports, leagues, teams,
  games, users, communities, debates, takes, and predictions.
- Migration validation and a clean-database test run in CI.

## Assumptions and decisions

- JSON is limited to provider snapshots, validated prediction options, and safe
  typed settings; relational fields remain relational.
- Sports-provider payloads are not the canonical database schema.
- Counts may be cached after measurement, but source rows remain authoritative.
