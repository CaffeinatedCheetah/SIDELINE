# Phase 1 Audit — Task List for Claude Code

Source: full 30-phase launch-readiness audit spec (see conversation/ticket). This file scopes
the FIRST, evidence-backed batch of work found by a live logged-out crawl of
https://sideline-wheat.vercel.app, a repo read, and a direct query against the Supabase
project (SIDELINE, ref wleunpfiokcdbuydkhho). Work top to bottom. Do not merge to
`main` without review. Return findings/diffs per item before moving to the next.

## CRITICAL — do this first

### 1. `/games`, `/hall-of-flame`, `/communities` hang on the loading skeleton for logged-out visitors
- **Files:** `app/games/page.tsx`, `app/hall-of-flame/page.tsx`, `app/communities/page.tsx`, `app/loading.tsx`, `lib/db/client.ts`, `prisma/schema.prisma`
- **Evidence (live crawl):** logged-out navigation to all three routes hit `app/loading.tsx`'s skeleton and it did not resolve during the session; `/communities` resolved to real content only on a second visit.
- **Evidence (Supabase, checked directly):** the data itself is fine and fast — direct SQL against the DB returns instantly: 2 rows in `Game`, 1 in `HallOfFlameEntry`, 1 in `Community`, 2 in `League`, 3 in `User`. So this is NOT an empty-data problem and the Postgres server itself is healthy (12 total connections, mostly idle, nothing stuck running a query). The stall is therefore almost certainly on the app's connection path, not the query logic or the data.
- **Root cause hypothesis (verify, don't assume):** All three pages are `export const dynamic = "force-dynamic"` async Server Components that call `db.<model>.findMany(...)` wrapped in a bare `try { } catch {}`. If the query *throws*, it silently falls back to an empty array and renders the EmptyState — that's not what was observed. What was observed is consistent with the connection *hanging* rather than erroring, which keeps Next's Suspense/`loading.tsx` boundary up indefinitely.
  - `prisma/schema.prisma` uses `env("DATABASE_URL")` for `url` and `env("DIRECT_URL")` for `directUrl`. Vercel has a manually-set `DATABASE_URL`/`DIRECT_URL` pair (type: sensitive) that is SEPARATE from the Supabase-provisioned vars already sitting in the same env (`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, etc., type: encrypted). Compare the actual values — `DATABASE_URL` should be the pooled/pgbouncer string (port 6543, `?pgbouncer=true&connection_limit=1`, per the repo's own `.env.example` comment), not a raw direct connection.
  - Corroborating signal from Supabase's own performance advisor: the project's Auth server is capped at an **absolute 10 connections** (not percentage-based), and current total Postgres connections were already at 12 during a quiet/idle period. On serverless (Vercel), every cold invocation can open a new direct connection if `DATABASE_URL` isn't actually pooled — that's exactly the kind of setup that hangs waiting for a free connection slot under any concurrent load, rather than failing fast.
- **Fix:**
  1. Confirm/fix the `DATABASE_URL` mapping in Vercel (Production + Preview) so it's the pooled connection string, and `DIRECT_URL` is the non-pooling one — diff against `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING` which Supabase already provisioned correctly.
  2. Remove the silent `catch {}` in these three pages (and any others using the same pattern) — log the error server-side and render a distinct "something went wrong loading this page" error state; never conflate a DB failure with a true empty state (Phase 20 requirement).
  3. Add a query/connection timeout so a hang degrades to an error state instead of an infinite skeleton.
  4. Add a Playwright check asserting these routes resolve past the skeleton within N seconds, logged-out.

### 2. Two auth systems' env vars coexist — resolve which one is real
- **Files:** check `middleware.ts`, `lib/auth/*`, any `app/auth/*` routes, `package.json` dependencies
- **Evidence:** Vercel env vars include both `CLERK_PUBLISHABLE_KEY` (Clerk) and `AUTH_SECRET`/`AUTH_URL`/`ENABLE_DEV_AUTH` (Auth.js/NextAuth-style, matching `.env.example`). The live `/auth/sign-in` page rendered a real sign-in form during the crawl, consistent with Auth.js.
- **Fix:** Confirm which system is actually wired in. If Clerk is a leftover from an earlier attempt, remove its env vars and any dead code. Also verify `ENABLE_DEV_AUTH` cannot be true in the Production Vercel env (it's currently set for both `production` and `preview` targets — confirm the value, not just that the key exists; `.env.example` says "Production validation rejects true", confirm that validation code actually exists and runs).

### 3. `ADMIN_PASSWORD` env var
- **Evidence:** Present in Vercel prod+preview env, type "sensitive" (not Supabase-provisioned).
- **Fix:** Find where it's read. A single shared admin password checked in app code is a Phase 22 red flag (no per-user accountability, no audit trail). The DB already has a `ModerationAction` table with RLS enabled but zero policies defined (see item 5) — that's the more likely correct mechanism; confirm whether `ADMIN_PASSWORD` should be retired in favor of it.

## HIGH

### 4. Confirm real vs. seeded sports data source
- **Evidence:** `BALLDONTLIE_KEY` exists as a Vercel env var (balldontlie.io — real NBA/NFL/MLB API), and `.env.example` says leaving `SPORTS_API_*` blank falls back to "deterministic demo sports data." Only 2 rows currently exist in `Game` and 2 in `League` in the live DB — confirm whether that's a live-sync gap (real integration exists but isn't populating) or the app is still on demo data.
- **File:** wherever `BALLDONTLIE_KEY` / `SPORTS_API_KEY` is consumed (search the repo for it).

### 5. Three tables have RLS enabled but zero policies
- **Evidence (Supabase security advisor):** `ModerationAction`, `RateLimitBucket`, and `VerificationToken` all have RLS turned on with no policies attached, meaning any query through the Supabase client/PostgREST (as opposed to the direct Prisma connection) against these tables returns nothing for every role. If any client-side code expects to read/write these via Supabase directly, it's silently broken; if everything only goes through Prisma with the service-role-equivalent direct connection, it's low risk but still worth an explicit policy for defense in depth.
- **Fix:** Decide the intended access pattern for each table and add matching policies (or confirm they're Prisma-only and document why RLS is a no-op there).

## MEDIUM — performance, not blocking

### 6. Missing indexes on ~20 foreign key columns
- **Evidence (Supabase performance advisor):** foreign keys without covering indexes on `Block`, `Comment`, `Community`, `Debate`, `GameFollow`, `GameParticipant`, `HallOfFlameEntry`, `ModerationAction`, `Notification`, `Poll`, `PollVote`, `Reaction`, `Report`, `SavedItem`, `UserBadge`, `Vote`. Fine at current data volume (single digits of rows) but will slow down as real users arrive — add before Phase 25 performance work, not after.

### 7. RLS policies re-evaluate `auth.*()` per row instead of once per query
- **Evidence:** ~25 policies (User, Account, Session, UserPreference, Notification, SavedItem, Block, Mute, Take, Vote, Comment, Reaction, Follow, CommunityMember, Report, Prediction, PollVote, GameFollow, Profile, Debate, Poll) call `auth.<function>()` directly instead of `(select auth.<function>())`. Cheap fix, meaningful at scale — batch-update all of them together.

### 8. `Session` table has no primary key
- Standard Prisma/NextAuth session table shape sometimes omits one; confirm if intentional or an oversight.

## Next batches (not yet crawled — pick up after the above)
Homepage hero/live-games/schedule/trending sections, Debate Center detail pages, Create Take flow,
authenticated navigation (My Arena, Settings — confirmed auth-gated correctly), full responsive/accessibility
passes. Re-run the logged-out crawl after fixing #1 since the skeleton stall may have been hiding
other defects on those three pages.
