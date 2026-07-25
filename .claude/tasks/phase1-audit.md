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
  Because PR #5's error-surfacing fix hasn't merged yet, production is still silently swallowing
  whatever is now failing and showing the generic empty-state copy, so there's no visible error to
  go on directly from those two pages.
- **NEW, concrete evidence pinning this down — read `app/page.tsx`'s `discovery()` function:**
  it runs `db.game.findMany`, `db.take.findMany`, `db.debate.findMany`, `db.community.findMany`,
  and `db.user.findFirst` together inside a single `Promise.all(...)`, wrapped in ONE try/catch.
  If even one of those five queries fails, the catch fires and **all five results are blanked to
  `[]`/`null` with `failed: true`** — which is exactly why the homepage crawl showed "Live right
  now," "Today's schedule," AND "Hall of Flame preview" all reporting "data unavailable"
  simultaneously. One failing query is taking down the whole homepage. This is almost certainly
  the same underlying failure as the `/games` and `/debates` emptiness — investigate as one root
  cause, not three separate bugs.
- **Suspect:** something about the new pooled connection string
  (`...pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1`).
  Known common failure mode with Prisma + PgBouncer in transaction-pooling mode: prepared
  statement handling (`pgbouncer=true` should disable them in Prisma — confirm it's actually
  taking effect for this Prisma version), or `connection_limit=1` being too restrictive for a
  `Promise.all` of 5 concurrent queries against the SAME connection pool (this is very plausibly
  the actual mechanism: 5 concurrent queries fighting over 1 allowed connection).
- **Do this first:** merge/deploy PR #5's logging so the real error surfaces, or add a temporary
  `console.error(error)` in the catch blocks of `app/page.tsx`, `app/games/page.tsx`, and the
  debates page, then hit all three routes and read Vercel function runtime logs. Get the actual
  Prisma error message before changing the connection string again. If it turns out to be the
  `connection_limit=1` + concurrent-query theory, try raising it (e.g. 3–5) as the fix, and also
  consider splitting `app/page.tsx`'s single `Promise.all`/single try-catch into five independent
  try/catches (mirrors the fix already applied to the individual pages) so one failing query can't
  blank the entire homepage even if this exact cause recurs later.

### 1c. "Trending takes" and "Find your crowd" homepage sections have no empty-state fallback
Separate, smaller bug in `app/page.tsx`: the shared `Section` component just renders `{children}`
with no fallback. When `data.takes` or `data.communities` is an empty array, those two sections
render as a bare heading + "View all" link with a blank grid underneath — no message at all,
unlike every other section on the page which has a real `EmptyState`. Add one for consistency.

## ✅ RESOLVED (partially — see 1b above for a possible regression)

### 1. `/games`, `/hall-of-flame`, `/communities`, `/debates` hung on the loading skeleton
The infinite-hang part is fixed and verified: `DATABASE_URL`/`DIRECT_URL` are now the pooled
Supabase connection with the `postgresql://` scheme the app's `lib/env.ts` validator requires.
Pages resolve in ~2s instead of hanging. Code-side fix (timeout wrapper, error state, tests, same
pattern in `/debates`) is in PR #5, awaiting review/merge. See items 1b/1c above for what's still
open before this item is fully closed out.

### 6–8. Supabase performance/security items
Applied directly via migration: ~23 missing FK indexes added, ~26 RLS policies rewritten to use
`(select auth.<function>())` instead of re-evaluating per row, RLS enabled on `_prisma_migrations`
(was the one ERROR-level security finding). Verified clean via `get_advisors` before/after. Only
remaining INFO-level items: `Session` has no primary key, and new indexes show "unused" simply
because there's no traffic yet.

### Create Take — partially verified
The real create-take path is well-built: `app/api/v1/[...segments]/route.ts` checks auth session,
verifies the user is `ACTIVE` and not banned/muted, applies rate limiting, and writes through
Prisma with fan-score/moderation hooks. `TakeComposer` (`components/actions/take-composer.tsx`)
posts to `/api/v1/takes` via a shared `apiAction()` helper that correctly redirects to
`/auth/sign-in?callbackUrl=...` on a 401. Confirmed live, logged-out: both the bottom-nav "Take"
link and the Debates page's "Start a debate" button redirect to sign-in with the callback URL
preserved — matches the Phase 8 requirement. Could not test the full logged-in post-and-see-it-
appear flow from this session (no credentials, and no live game/debate visible to attach a take to
while item 1b is unresolved) — worth a real authenticated Playwright pass once 1b is fixed.

**New finding while checking this:** there's an orphaned legacy `api/takes.js` (and `api/fan-takes.js`)
at the repo root — NOT under `app/api/`, these are separate Vercel serverless functions (same
convention as `api/agent-scout.js`, which is in the deployment's `functions` config and has a daily
cron in `vercel.json`). `api/takes.js` stores takes in an in-memory `globalThis.__SL_TAKES` array
with zero Prisma/database involvement — data that vanishes on every cold start and every deploy.
Confirmed the real UI does NOT call this (it calls `/api/v1/takes` instead), so it's dead code, but
it's still a live, unauthenticated, publicly-reachable POST endpoint with no real validation. Low
risk but worth deleting for hygiene, or investigating why it exists first — it and `api/fan-takes.js`
look like leftovers from a pre-Prisma prototype. Also worth a quick look: `vercel.json` schedules six
daily cron jobs (`agent-scout`, `agent-pulse`, `agent-social`, `agent-hunter`, `push-notify`,
`agent-rivals`) — haven't investigated what these do yet; flagging in case they're also writing to
the legacy in-memory store instead of the real DB.

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

### 9. Orphaned legacy in-memory API routes (`api/takes.js`, `api/fan-takes.js`)
See "Create Take — partially verified" above. Dead code, not called by the current UI, but still
live and publicly reachable. Delete or gate them, and check what the six daily cron jobs
(`agent-scout`, `agent-pulse`, `agent-social`, `agent-hunter`, `push-notify`, `agent-rivals`) in
`vercel.json` actually write to before assuming they're harmless.

## MEDIUM — not blocking

### `Session` table has no primary key
Supabase linter flags it as INFO only; confirm if intentional or worth a real migration.

## Next batches (not yet crawled)
Authenticated navigation, full responsive/accessibility passes still pending.
