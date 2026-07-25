# Phase 1 Audit — Task List for Claude Code

Source: full 30-phase launch-readiness audit spec. Work top to bottom. Do not merge to `main`
without review. Return findings/diffs per item before moving to the next.

## ✅ RESOLVED

### 1. `/games`, `/hall-of-flame`, `/communities`, `/debates` hung on the loading skeleton
Fixed and verified live. Root cause: `DATABASE_URL`/`DIRECT_URL` were not the pooled Supabase
connection, and the app's own `lib/env.ts` Zod validator requires the `postgresql://` scheme
(Supabase issues `postgres://`), which also caused a failed deploy along the way. Both are now
fixed directly in Vercel (Production + Preview) and confirmed live: `/games` resolves in ~2s
logged-out instead of hanging indefinitely. Code-side fix (timeout wrapper, error state, tests,
and the same pattern in `/debates`) is in PR #5, awaiting review/merge.
**Follow-up still open:** right after the env fix deployed, `/games` rendered "No games match"
despite 2 real rows in `Game`. Worth a quick check once PR #5 merges — could be stale cache from
the redeploy, could be something else (e.g. a status/date filter silently excluding both rows).

### 6–8. Supabase performance/security items
Applied directly via migration: ~23 missing FK indexes added, ~26 RLS policies rewritten to use
`(select auth.<function>())` instead of re-evaluating per row, RLS enabled on `_prisma_migrations`
(was the one ERROR-level security finding — a publicly-exposed Prisma metadata table). Verified
clean via `get_advisors` before/after. Only remaining INFO-level items: `Session` has no primary
key (needs a real migration, left for you), and a few newly-created indexes show as "unused" simply
because there's no traffic yet.

## CRITICAL — do this next

### 2. Auth.js in Production has **zero configured providers** — sign-in is likely completely non-functional
This is bigger than the "two auth systems" framing suggested. Confirmed by reading `auth.ts` and
the actual Vercel env inventory:
- `auth.ts` only pushes a provider into the `providers[]` array if `AUTH_GOOGLE_ID`+`AUTH_GOOGLE_SECRET`
  are set, or `EMAIL_SERVER` is set, or (`NODE_ENV !== "production"` AND `ENABLE_DEV_AUTH === "true"`)
  for the dev Credentials provider.
- **None of `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, or `EMAIL_SERVER` exist at all** in the Vercel
  project's env vars (checked the full 36-entry list — they're simply not there, not even empty).
- Vercel sets `NODE_ENV=production` for every optimized build regardless of Preview vs Production
  *target* — this is a well-known Next.js/Vercel behavior, not something specific to this app. So
  the dev Credentials provider's `NODE_ENV !== "production"` guard is very likely false everywhere
  Vercel deploys, Preview included.
- **Net effect: `providers` is probably `[]` in every deployed environment.** The `/auth/sign-in`
  page rendering a form (confirmed in the live crawl) doesn't mean it works — there's a real chance
  submitting it has nothing to authenticate against.
- **Verify this first**, don't just trust the reasoning: deploy a temporary log of
  `providers.length` (or check the rendered sign-in page for which provider buttons/fields actually
  appear — NextAuth renders differently with zero providers), or run the Playwright auth flow
  against a Preview deployment and see what actually happens on submit.
- If confirmed: this is THE launch blocker, above everything else in this file. Fix by either (a)
  setting up real Google OAuth credentials and adding `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, (b)
  setting up a real `EMAIL_SERVER` for magic-link sign-in, or (c) both. Whichever you pick, add a
  Playwright test that actually completes a sign-in, not just one that checks the form renders.

### 2b. Clerk is fully dead code — safe to remove
- Confirmed: `clerk` does not appear anywhere in a full-repo GitHub code search, and
  `package.json` has no Clerk dependency at all (only `next-auth` + `@auth/prisma-adapter`).
- It's referenced in exactly two places, both harmless leftovers: the `CLERK_PUBLISHABLE_KEY`
  Vercel env var, and `*.clerk.accounts.dev` in the CSP `script-src`/`frame-src` directives in
  `vercel.json`.
- Fix: delete the `CLERK_PUBLISHABLE_KEY` env var (both targets) and remove the two
  `https://*.clerk.accounts.dev` entries from the CSP in `vercel.json`. Low risk, quick win.

### 3. `ADMIN_PASSWORD` env var
- **Evidence:** Present in Vercel prod+preview env, type "sensitive" (not Supabase-provisioned).
- **Fix:** Find where it's read. A single shared admin password checked in app code is a Phase 22
  red flag (no per-user accountability, no audit trail). The DB already has a `ModerationAction`
  table (RLS enabled, policies now need to be added per item 5 below) — confirm whether
  `ADMIN_PASSWORD` should be retired in favor of real role-based moderator accounts.

## HIGH

### 4. Confirm real vs. seeded sports data source
- **Evidence:** `BALLDONTLIE_KEY` exists as a Vercel env var (balldontlie.io — real NBA/NFL/MLB
  API), and `.env.example` says leaving `SPORTS_API_*` blank falls back to "deterministic demo
  sports data." Only 2 rows exist in `Game` and 2 in `League` in the live DB — confirm whether
  that's a live-sync gap (real integration exists but isn't populating) or the app is still on demo
  data.
- **File:** wherever `BALLDONTLIE_KEY` / `SPORTS_API_KEY` is consumed (search the repo for it).

### 5. Three tables have RLS enabled but zero policies
- **Evidence (Supabase security advisor):** `ModerationAction`, `RateLimitBucket`, and
  `VerificationToken` all have RLS on with no policies, meaning any Supabase-client/PostgREST
  access to them returns nothing for every role. If everything only goes through Prisma's direct
  connection this is low-risk, but still worth an explicit policy for defense in depth — especially
  once item 3 (ADMIN_PASSWORD → real moderator roles) is resolved and `ModerationAction` starts
  being written to from more places.
- **Fix:** Decide the intended access pattern for each table and add matching policies (or confirm
  they're Prisma-only and document why RLS is a no-op there).

## MEDIUM — not blocking

### `Session` table has no primary key
Standard Prisma/NextAuth session table shape sometimes omits one; confirm if intentional (Supabase
linter flags it as INFO) or an oversight worth a real migration.

## Next batches (not yet crawled — pick up after the above)
Homepage hero/live-games/schedule/trending sections, Debate Center detail pages, Create Take flow,
authenticated navigation (My Arena, Settings — confirmed auth-gated correctly, though item 2 may
make "authenticated" moot until fixed), full responsive/accessibility passes.
