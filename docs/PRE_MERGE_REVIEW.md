# FanTakes Version 1 pre-merge review

Reviewed: 2026-07-23

Branch: `claude/fantakes-v1-implementation`

Baseline: `e3cf6cb23868f1198627feeffd8fc321b4b5b1fe`

## Review method

This review compares the implementation with every product contract under
`docs/`. A route or model alone is not treated as a completed user flow.
Database-backed claims in the verification update were exercised against the
dedicated Supabase project using pooled runtime and direct migration
connections. No database was reset, and disposable integration records were
cleaned after each run.

## Initial finding matrix

This matrix preserves the findings at the start of database validation. The
database-backed verification update and current release matrix below are
authoritative where they supersede an initial row.

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

## Database-backed verification update

The earlier matrix records the gaps found before a database was available. The
following evidence supersedes only the rows explicitly listed here:

| Area                        | Verified result                                                                                                            | Evidence                                                    | Remaining gap                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Migration and schema        | `202607220001_initial` applied; migration status current; no schema drift; all 35 migration-defined unique indexes present | Prisma deploy/status/diff and PostgreSQL catalog inspection | None identified                                                                  |
| Seed                        | Two successful runs produced stable expected counts and working relations                                                  | Supabase row-count and relation inspection                  | Preview seed remains manual and opt-in                                           |
| Authentication              | Development login, refresh persistence, logout, and protected-route redirect passed                                        | `tests/e2e/authenticated-database.spec.ts`                  | Google and SMTP require external credentials                                     |
| Profile/onboarding          | Profile, interests, preferences, and onboarding completion persisted                                                       | `tests/integration/database-flows.test.ts`                  | Fresh-user browser onboarding is not yet automated                               |
| Communities                 | Join, preference update, leave, rejoin, and duplicate prevention passed                                                    | PostgreSQL integration                                      | Preference UI remains incomplete                                                 |
| Takes                       | Create, reply, ownership rejection, edit, tombstone delete, vote update, reaction, save, and unsave passed                 | PostgreSQL integration                                      | Several controls remain unwired in the browser UI                                |
| Debates and polls           | Creation, valid voting, server totals, and duplicate-vote constraints passed                                               | PostgreSQL integration                                      | Full mutation browser flows remain incomplete                                    |
| Game Room and predictions   | Game take persisted; live prediction rejected; future prediction upsert remained unique                                    | PostgreSQL integration                                      | Provider-backed resolution is not configured                                     |
| Social and notifications    | Follow/unfollow, unique relationship, notification creation, unread state, and read mutation passed                        | PostgreSQL integration                                      | Broader event/deep-link browser coverage remains                                 |
| Fan Score and Hall of Flame | Ledger idempotency and repeated deterministic ranking passed                                                               | PostgreSQL integration                                      | The complete scoring policy remains narrower than the full product specification |
| Moderation                  | Report creation, normal-user rejection, administrator action, and audit record passed                                      | PostgreSQL integration                                      | All moderation actions do not yet apply their final user/content effects         |
| Account deletion            | Pending-deletion state persisted and subsequent authenticated mutation was rejected                                        | PostgreSQL integration                                      | Retention, cancellation, and final anonymization remain incomplete               |

These results establish database and controlled-preview readiness. They do not
convert the remaining partial UI and product-policy rows into completed Version
1 features.

## Current release matrix

| Requirement                         | Current status                    | Evidence                                                                              | Remaining gap                                                                                | Severity | Recommendation                         |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- | -------------------------------------- |
| Database migration, seed, and drift | Complete                          | Two applied migrations, repeated seed, zero drift                                     | Existing Supabase project is shared with preview rather than per-branch isolated             | Low      | Accept for controlled preview          |
| Authentication and sessions         | Locally verified                  | Authenticated Playwright and PostgreSQL integration                                   | Vercel provider variables and callbacks cannot be inspected until project access is restored | Blocker  | Restore Vercel access                  |
| Public routes                       | Locally verified                  | 15-route Chromium sweep, no console/HTTP errors                                       | Repeat against deployed preview                                                              | Blocker  | Restore Vercel access                  |
| Responsive behavior                 | Locally verified                  | No homepage overflow at all eight required widths                                     | Full deployed-page sweep remains pending                                                     | High     | Complete after preview exists          |
| Distributed rate limiting           | Complete                          | Atomic PostgreSQL buckets, route policies, hashed anonymous keys, `Retry-After` tests | Periodic expired-bucket cleanup may be added operationally                                   | Low      | Accept                                 |
| Moderation enforcement              | Complete at backend boundary      | PostgreSQL tests for report, reject, remove, restore, warn, mute, ban, and audit      | Moderator action controls remain absent from the queue UI                                    | High     | Complete UI before Version 1 release   |
| Critical mutation persistence       | Complete at API/database boundary | 11 PostgreSQL integration flows                                                       | Several browser controls remain unwired                                                      | High     | Do not claim UI completion             |
| Authenticated browser coverage      | Partial                           | Login/session/logout flow passes                                                      | Fresh onboarding and nine mutation/moderation flows remain incomplete                        | High     | Expand before Version 1 merge          |
| Dependency advisories               | Mitigated, unresolved upstream    | 15 complete / 9 production-only audit findings                                        | No compatible non-breaking fix for Auth.js/Next paths                                        | High     | Monitor upstream; do not force-upgrade |
| Vercel deployment                   | Blocked before build              | GitHub Vercel status links to account-block page                                      | GitHub Login Connection/project contributor access                                           | Blocker  | Dashboard action required              |

## Assumptions and decisions

- `DATABASE_URL` is the pooled runtime connection and `DIRECT_URL` is the direct
  migration connection. They may be identical for local PostgreSQL.
- Preview demo seeding is a deliberate manual operation. It is never part of a
  production deployment command.
- Missing external Google, SMTP, sports, analytics, and hosting credentials are
  configuration dependencies, not reasons to invent fake integrations.
- The configured Supabase project is treated as development/preview
  infrastructure. Production seeding remains prohibited by default.

## Merge recommendation

**Not yet deployable or merge-ready.** Database migration, repeatable seed,
schema drift, core authentication, persistence, authorization, distributed
limits, and moderation enforcement have real Supabase evidence. Vercel blocks
the connected Git deployment before build because the GitHub identity lacks
recognized project access. After that dashboard issue is corrected, deployed
route/auth/responsive QA is still required. Remaining Version 1 product gaps
are moderator action UI and broader authenticated mutation browser coverage.
