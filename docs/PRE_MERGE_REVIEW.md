# FanTakes Version 1 pre-merge review

Reviewed: 2026-07-22

Branch: `claude/fantakes-v1-implementation`

Baseline: `e3cf6cb23868f1198627feeffd8fc321b4b5b1fe`

## Review method

This review compares the implementation with every product contract under
`docs/`. A route or model alone is not treated as a completed user flow. “DB
blocked” means the code was inspected and may have unit evidence, but has not
been exercised against PostgreSQL because neither `DATABASE_URL` nor
`DIRECT_URL` was available. No production or important database was reset.

## Requirement matrix

| Requirement                             | Implementation status                           | Route or file                                             | Test coverage                      | Remaining gap                                                                 | Severity                  | Merge recommendation                      |
| --------------------------------------- | ----------------------------------------------- | --------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- | ------------------------- | ----------------------------------------- |
| Framework, strict TypeScript, styling   | Implemented                                     | `app/`, `tsconfig.json`, `app/globals.css`                | Lint, typecheck, build             | None identified                                                               | Low                       | Accept                                    |
| Shared accessible UI primitives         | Implemented                                     | `components/ui/`                                          | Component and axe tests            | Broader browser accessibility pass remains                                    | Low                       | Accept with follow-up                     |
| PostgreSQL schema and initial migration | Implemented, not executed in this environment   | `prisma/schema.prisma`, `prisma/migrations/`              | Prisma generation only             | Apply, inspect constraints, and run drift status on isolated PostgreSQL       | Blocker                   | Do not merge yet                          |
| Deterministic idempotent demo seed      | Corrected, not executed                         | `prisma/seed.ts`                                          | Static review                      | Run twice and compare row counts/content                                      | Blocker                   | Do not merge yet                          |
| Managed pooled/direct connections       | Implemented                                     | `.env.example`, `prisma/schema.prisma`, `lib/env.ts`      | Prisma generation                  | Validate provider-specific pooled and direct URLs                             | High                      | Validate before preview                   |
| Development login                       | Implemented, not DB verified                    | `auth.ts`, `/auth/sign-in`                                | Public smoke only                  | Login, refresh persistence, logout, inactive-account rejection                | Blocker                   | Do not merge yet                          |
| Google OAuth and email links            | Configurable                                    | `auth.ts`, `lib/env.ts`                                   | Static review                      | Credential-dependent callback and delivery checks                             | Deferred by specification | Configure for preview                     |
| Onboarding persistence                  | Implemented, not DB verified                    | `/onboarding`, profile-complete API                       | None against DB                    | Verify step persistence, interests, uniqueness conflict, redirect             | Blocker                   | Do not merge yet                          |
| Public discovery routes                 | Implemented                                     | `/`, `/games`, `/debates`, `/communities`, profiles, Hall | Four Playwright smoke cases        | Database empty/error behavior needs live verification                         | Medium                    | Validate before merge                     |
| Authenticated shell and My Arena        | Implemented                                     | `app/(app)/`, `/arena`                                    | Component-level navigation         | Personalized DB queries and empty/error states not integrated-tested          | High                      | Do not merge yet                          |
| Game directory and live polling         | Partially implemented                           | `/games`, `live-game-room.tsx`                            | Static/unit review                 | Provider absent; browser cleanup and stale-response behavior need test        | Medium                    | Preview with demo label only              |
| Game chat, replies, reactions           | Partially implemented                           | take/comment/reaction APIs                                | No DB/E2E evidence                 | Distinct chat experience and visible interaction controls are incomplete      | High                      | Do not merge as complete                  |
| Game polls                              | Backend creation/vote routes only               | poll APIs, `poll-card.tsx`                                | No DB/E2E evidence                 | Poll voting UI and persistence flow are not connected                         | High                      | Do not merge as complete                  |
| Predictions and locking                 | Implemented, not DB verified                    | prediction API, `predictions.ts`                          | Lock unit tests                    | Persistence, duplicate submission, resolution, score update unverified        | Blocker                   | Do not merge yet                          |
| Take creation                           | Implemented, not DB verified                    | `take-composer.tsx`, take API                             | Component request test             | Required idempotency contract and context permission checks incomplete        | High                      | Do not merge as complete                  |
| Take edit/delete                        | Backend added during review                     | PATCH/DELETE take API                                     | Static/type coverage only          | UI, ownership, 15-minute conflict, tombstone persistence need DB tests        | High                      | Do not merge as complete                  |
| Take agree/disagree, reply, save        | Backend pieces only                             | vote/comment/reaction/saved APIs, `take-card.tsx`         | Card rendering only                | Visible controls are not wired end to end                                     | High                      | Do not merge as complete                  |
| Debate create and vote                  | Creation transport corrected; backend present   | `/debates/new`, debate/vote APIs                          | Component request and policy units | DB uniqueness/concurrency, percentages, reply/report flows unverified         | Blocker                   | Do not merge yet                          |
| Communities join/leave/preferences      | Backend and join button present                 | community membership API                                  | Component request only             | DB persistence/counts, duplicate concurrency, preference UI unverified        | Blocker                   | Do not merge yet                          |
| Community membership permissions        | Partial                                         | take/poll/community routes                                | Static review                      | Community writes do not consistently require active membership                | High                      | Correct before merge                      |
| Profiles and settings                   | Partial                                         | `/users/[handle]`, `/settings`                            | Public/component coverage          | Favorite interests, privacy, notification, sessions, blocks/mutes incomplete  | High                      | Do not merge as complete                  |
| Social follow graph                     | Backend only                                    | follow API                                                | Unit permission coverage only      | UI, persistence, counts, concurrency, notifications unverified                | High                      | Do not merge as complete                  |
| Notifications                           | Partial                                         | `/notifications`, notification APIs                       | No DB/E2E evidence                 | Mutation-generated notifications and open-then-read flow incomplete           | High                      | Do not merge as complete                  |
| Fan Score ledger                        | Core service implemented                        | `lib/scoring/fan-score.ts`                                | Direct unit tests                  | Only take creation currently emits; prediction/reaction policies incomplete   | High                      | Do not merge as complete                  |
| Hall of Flame ranking                   | Core and job implemented                        | scoring/job modules                                       | Deterministic ranking unit         | Job currently lacks report-count input and live eligibility verification      | High                      | Correct before merge                      |
| Reports and moderation                  | Partial                                         | report/moderation APIs, `/moderation`                     | Permission units only              | Action records do not yet apply remove/warn/mute/ban effects; UI read-only    | High                      | Do not merge as complete                  |
| Account deletion                        | Pending state and explicit sign-out implemented | account DELETE, danger zone                               | No DB/E2E evidence                 | Verify JWT invalidation, authorization, cancellation/retention workflow       | Blocker                   | Do not merge yet                          |
| Search                                  | Implemented                                     | `/search`, search API                                     | UI unit/smoke                      | Authored-take search conflicts with documented privacy-review deferral        | Medium                    | Restrict or document decision             |
| API error envelope                      | Hardened                                        | `lib/api/http.ts`, API boundary                           | Direct unit tests                  | Request IDs/422 field shape and 405 `Allow` remain inconsistent with spec     | Medium                    | Align before public API freeze            |
| Mutation idempotency                    | Partial via DB uniqueness/upserts               | memberships, follows, votes, score                        | Domain units                       | Required idempotency keys absent for takes, reports, moderation               | High                      | Correct before merge                      |
| Rate limiting                           | Development abstraction only                    | `lib/api/rate-limit.ts`                                   | Direct unit test                   | In-memory state is not reliable across preview/serverless instances           | High                      | Add managed adapter before public preview |
| Authorization and IDOR resistance       | Partial                                         | API route, server actions                                 | Mostly static review               | Active-state check added to API; resource membership/target checks incomplete | High                      | Correct and DB-test before merge          |
| Accessibility                           | Foundation implemented                          | shared components/pages                                   | axe smoke tests                    | Full keyboard/dialog/page sweep outstanding                                   | Medium                    | Validate before release                   |
| SEO and metadata                        | Implemented                                     | layout, sitemap, robots                                   | Build/smoke                        | Preview indexing policy must be configured at deployment                      | Medium                    | Set preview robots policy                 |
| Preview deployment workflow             | Partially prepared                              | README, scripts, environment                              | Build previously passed            | Live migration, callbacks, cookies, health behavior, logs unverified          | Blocker                   | Do not deploy yet                         |
| Database integration suite              | Not implemented/executed                        | `tests/`                                                  | None                               | Isolated DB harness and cleanup/transaction strategy required                 | Blocker                   | Do not merge yet                          |
| Authenticated Playwright flows          | Not implemented/executed                        | `tests/e2e/`                                              | Public smoke only                  | Ten required persistence/authorization flows remain                           | Blocker                   | Do not merge yet                          |
| Sports provider                         | Intentionally absent                            | environment hooks only                                    | None                               | Demo data must remain visibly labeled                                         | Deferred by specification | Non-blocking for demo preview             |
| Data export                             | Explicit disabled state                         | settings danger zone                                      | None                               | Legal/retention implementation deferred                                       | Deferred by specification | Keep disabled                             |

## Confirmed corrections in this review

- Added an explicit tracked `.env.example` with separate pooled and direct
  PostgreSQL URLs and optional integration variables.
- Made preview seeding opt-in and made seeded takes stable across repeated runs.
- Converted debate creation to the existing JSON mutation boundary.
- Made malformed JSON return validation output rather than escape parsing.
- Limited duplicate-vote handling to actual unique-constraint conflicts.
- Added active-account enforcement to API identity resolution.
- Added take author edit/tombstone operations and a single-notification read
  operation.
- Made account deletion explicitly clear the browser session after the database
  transition.
- Added a safe JSON error boundary for unexpected API failures.

These corrections require PostgreSQL-backed verification before they can be
accepted as complete.

## Assumptions and decisions

- `DATABASE_URL` is the pooled runtime connection and `DIRECT_URL` is the direct
  migration connection. They may be identical for local PostgreSQL.
- Preview demo seeding is a deliberate manual operation. It is never part of a
  production deployment command.
- Missing external Google, SMTP, sports, analytics, and hosting credentials are
  configuration dependencies, not reasons to invent fake integrations.
- The repository cannot claim database-backed readiness until an isolated test
  database is supplied and all required persistence/concurrency tests pass.

## Merge recommendation

**Do not merge or deploy this branch yet.** The static application foundation is
sound and the focused fixes above are appropriate, but PostgreSQL migration,
seed, authentication, persistence, concurrency, and authorization evidence is
absent. Several documented interaction surfaces also remain partial. The next
required input is an isolated PostgreSQL pooled connection and its direct
migration connection; no production or important account should be used.
