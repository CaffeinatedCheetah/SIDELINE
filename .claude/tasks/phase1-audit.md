# Phase 1 Audit — Task List for Claude Code

Source: full 30-phase launch-readiness audit spec (see conversation/ticket). This file scopes
the FIRST, evidence-backed batch of work found by a live logged-out crawl of
https://sideline-wheat.vercel.app plus a repo read. Work top to bottom. Do not merge to
`main` without review. Return findings/diffs per item before moving to the next.

## CRITICAL — do this first

### 1. `/games`, `/hall-of-flame`, `/communities` hang on the loading skeleton for logged-out visitors
- **Files:** `app/games/page.tsx`, `app/hall-of-flame/page.tsx`, `app/communities/page.tsx`, `app/loading.tsx`, `lib/db/client.ts`, `prisma/schema.prisma`
- **Evidence:** Live crawl (logged-out) hit `app/loading.tsx`'s skeleton on first navigation to all three routes and it did not resolve during the session; `/communities` resolved to real content only on a second visit.
- **Root cause hypothesis (verify, don't assume):** All three pages are `export const dynamic = "force-dynamic"` async Server Components that call `db.<model>.findMany(...)` wrapped in a bare `try { } catch {}`. If the query *throws*, it silently falls back to an empty array and renders the EmptyState — that's NOT what we saw. What we saw is consistent with the query *hanging* (never throwing, never resolving), which keeps Next's Suspense/`loading.tsx` boundary up indefinitely. Most likely cause: `DATABASE_URL` (used by `prisma/schema.prisma`'s `datasource db { url = env("DATABASE_URL") }`) is not the pooled/pgbouncer connection string, so concurrent serverless invocations exhaust Postgres connections. Vercel env vars confirm both a manually-set `DATABASE_URL`/`DIRECT_URL` pair (type: sensitive) AND a full set of Supabase-provisioned vars (`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, etc., type: encrypted) exist side by side — compare them; `DATABASE_URL` should equal the pooled `POSTGRES_PRISMA_URL`-style value (port 6543, `?pgbouncer=true&connection_limit=1` per the repo's own `.env.example` comment), and `DIRECT_URL` should be the non-pooling one.
- **Fix:**
  1. Confirm/fix the env var mapping in Vercel (Production + Preview).
  2. Remove the silent `catch {}` in these three pages (and any others using the same pattern) — log the error server-side and render a distinct "something went wrong loading this page" error state, never conflate a DB failure with a true empty state (Phase 20 requirement).
  3. Add a query timeout so a DB hang degrades to an error state instead of an infinite skeleton.
  4. Add a Playwright check that asserts these routes resolve past the skeleton within N seconds, logged-out.

### 2. Two auth systems' env vars coexist — resolve which one is real
- **Files:** check `middleware.ts`, `lib/auth/*`, any `app/auth/*` routes, `package.json` dependencies
- **Evidence:** Vercel env vars include both `CLERK_PUBLISHABLE_KEY` (Clerk) and `AUTH_SECRET`/`AUTH_URL`/`ENABLE_DEV_AUTH` (Auth.js/NextAuth-style). `.env.example` documents the Auth.js-style vars and an `ENABLE_DEV_AUTH` dev-only bypass flag ("Production validation rejects true" — verify that validation actually exists and fires).
- **Fix:** Determine which auth system is actually wired into the live app (check `app/auth/sign-in` — it rendered a real sign-in form during the crawl). If Clerk is a leftover from an earlier attempt, remove its env vars and any dead code. If both are partially wired, pick one and finish it — this is exactly the kind of half-migrated state Phase 2 is meant to catch. Also verify `ENABLE_DEV_AUTH` cannot be true in the Production Vercel env (it's currently set for both `production` and `preview` targets per the env list — confirm the value, not just that the key exists).

### 3. `ADMIN_PASSWORD` env var
- **Evidence:** Present in Vercel prod+preview env, type "sensitive" (not Supabase-provisioned).
- **Fix:** Find where it's read. A single shared admin password checked in app code is a Phase 22 red flag (no per-user accountability, easy to leak, no audit trail). Confirm what it gates and whether real moderator/admin roles (Phase 17) should replace it instead.

## HIGH

### 4. Confirm real vs. seeded sports data source
- **Evidence:** `BALLDONTLIE_KEY` exists as a Vercel env var (balldontlie.io — real NBA/NFL/MLB API), and `.env.example` says leaving `SPORTS_API_*` blank falls back to "deterministic demo sports data." Need to confirm in Production the real key is active and actually used, and that no seeded/demo games are shown to real users (Phase 4).
- **File:** wherever `BALLDONTLIE_KEY` / `SPORTS_API_KEY` is consumed (search the repo for it).

## Next batches (not yet crawled — pick up after the above)
Homepage hero/live-games/schedule/trending sections, Debate Center detail pages, Create Take flow,
authenticated navigation (My Arena, Settings — confirmed auth-gated correctly), full responsive/accessibility
passes. Re-run the logged-out crawl after fixing #1 since the skeleton stall may have been hiding
other defects on those three pages.
