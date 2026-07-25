# Phase 1 Audit — Task List for Claude Code

Source: full 30-phase launch-readiness audit spec. Work top to bottom. Do not merge to `main`
without review. Return findings/diffs per item before moving to the next.

## 🚨 URGENT — likely regression from the connection-string fix, investigate before anything else

### 1b. `/games` and `/debates` now return empty results that should have data
Both `/games` and `/debates` are showing empty states ("No games match" / "No open debates")
for data that definitely exists and definitely matches the query's own filters:
- `Game` table has 2 rows: one `status = 'LIVE'`, one `status = 'SCHEDULED'` — both pass the
  page's default (no-filter) query, which should return both with an empty `where: {}`.
- `Debate` table has 1 row: `status = 'OPEN'`, title "Who has the NFC North's best defense?".
- Earlier in this session, `/debates` loaded this exact debate card successfully (confirmed via
  live crawl, before the `DATABASE_URL`/`DIRECT_URL` connection-string change in item 1). After
  that env var change + redeploy, a fresh crawl of both `/games` and `/debates` now shows empty
  results.
- **This looks like a regression introduced by the pooled-connection switch, not missing data.**
  Because PR #5's error-surfacing fix (replacing the silent `catch {}` with a distinct error state)
  hasn't merged yet, production is still silently swallowing whatever is now failing and showing
  the generic empty-state copy, so there's no visible error to go on.
- **Suspect:** something about the new pooled connection string
  (`...pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1`).
  Known common failure mode with Prisma + PgBouncer in transaction-pooling mode: prepared
  statement handling. `pgbouncer=true` is supposed to tell Prisma to disable prepared statements,
  but worth confirming that's actually taking effect, and whether `connection_limit=1` is too
  restrictive under this app's query patterns (e.g. multiple `db.*` calls per request needing
  more than one connection at once).
- **Do this first:** merge (or at least deploy from) PR #5 so the real error actually surfaces
  server-side, or add a temporary `console.error` with the full error object in the existing
  `catch` blocks and check Vercel function runtime logs after hitting `/games` and `/debates`.
  Don't guess — get the actual Prisma error message before changing the connection string again.

## ✅ RESOLVED (partially — see 1b above for a possible regression)

### 1. `/games`, `/hall-of-flame`, `/communities`, `/debates` hung on the loading skeleton
The infinite-hang part is fixed and verified: `DATABASE_URL`/`DIRECT_URL` are now the pooled
Supabase connection with the `postgresql://` scheme the app's `lib/env.ts` validator requires.
Pages resolve in ~2s instead of hanging. Code-side fix (timeout wrapper, error state, tests, same
pattern in `/debates`) is in PR #5, awaiting review/merge. See item 1b: something about this same
change may have introduced a new empty-results problem that needs to be root-caused before this
item is fully closed out.

### 6–8. Supabase performance/security items
Applied directly via migration: ~23 missing FK indexes added, ~26 RLS policies rewritten to use
`(select auth.<function>())` instead of re-evaluating per row, RLS enabled on `_prisma_migrations`
(was the one ERROR-level security finding). Verified clean via `get_advisors` before/after. Only
remaining INFO-level items: `Session` has no primary key, and new indexes show "unused" simply
because there's no traffic yet.

## CRITICAL

### 2. Auth.js in Production has **zero configured providers** — sign-in is likely completely non-functional
Confirmed by reading `auth.ts` and the actual Vercel env inventory:
- `auth.ts` only pushes a provider if `AUTH_GOOGLE_ID`+`AUTH_GOOGLE_SECRET` are set, or
  `EMAIL_SERVER` is set, or (`NODE_ENV !== "production"` AND `ENABLE_DEV_AUTH === "true"`).
- **None of `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, or `EMAIL_SERVER` exist at all** in Vercel's
  env vars.
- Vercel sets `NODE_ENV=production` for every optimized build regardless of Preview vs Production
  target, so the dev-Credentials guard is very likely false everywhere.
- **Net effect: `providers` is probably `[]` in every deployed environment.** Verify with an actual
  Playwright sign-in attempt against a Preview deployment before assuming the reasoning is right.
- If confirmed: this is THE launch blocker. Fix needs real credentials from Babs (Google OAuth
  and/or SMTP) — propose the options, don't just pick one.

### 2b. Clerk is fully dead code — safe to remove
Confirmed zero references anywhere in the repo and no Clerk dependency in `package.json` (only
`next-auth` + `@auth/prisma-adapter`). Only two leftovers: the `CLERK_PUBLISHABLE_KEY` Vercel env
var, and two `https://*.clerk.accounts.dev` entries in the CSP in `vercel.json`. Low-risk, go ahead
and remove both.

### 3. `ADMIN_PASSWORD` env var
Present in Vercel prod+preview env, type "sensitive". Find where it's read — a single shared admin
password is a Phase 22 red flag (no per-user accountability, no audit trail). `ModerationAction`
table (RLS enabled, needs policies per item 5) is the more likely correct mechanism; confirm
whether `ADMIN_PASSWORD` should be retired in favor of it.

## HIGH

### 4. Confirm real vs. seeded sports data source
`BALLDONTLIE_KEY` exists (real NBA/NFL/MLB API). `.env.example` says blank `SPORTS_API_*` falls
back to "deterministic demo sports data." Only 2 rows exist in `Game`, 2 in `League` — confirm
whether that's a live-sync gap or still demo data. Search the repo for where the key is consumed.

### 5. Three tables have RLS enabled but zero policies
`ModerationAction`, `RateLimitBucket`, `VerificationToken` — RLS on, no policies, so any
Supabase-client/PostgREST access returns nothing for every role. Low risk if everything goes
through Prisma's direct connection, but worth an explicit policy for defense in depth, especially
once item 3 pushes more traffic through `ModerationAction`.

## MEDIUM — not blocking

### `Session` table has no primary key
Supabase linter flags it as INFO only; confirm if intentional or worth a real migration.

## Next batches (not yet crawled)
Homepage sections (`Live right now`, `Today's schedule`, `Hall of Flame preview`) already show a
proper "data unavailable" error state rather than hanging or faking data — that pattern already
exists somewhere in the codebase and is worth reusing for item 1b's fix instead of building a new
one. `Trending Takes` and `Find your crowd` sections render as fully empty (no cards, no error, no
empty-state message) — worth checking whether that's correct empty-state handling or another gap.
Create Take flow, authenticated navigation, full responsive/accessibility passes still pending.
