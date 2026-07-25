# Phase 1 Audit — Task List for Claude Code

Source: full 30-phase launch-readiness audit spec. Work top to bottom. Do not merge to `main`
without review. Return findings/diffs per item before moving to the next.

## 🚨 BLOCKING — needs a decision from Babs before any DB-touching work continues

### 1b. DATABASE_URL/DIRECT_URL point at the WRONG Supabase project (not a pooling bug)
Claude Code found the real root cause of the `/games`/`/debates` emptiness: `DATABASE_URL` was
pointed at Vercel's auto-provisioned Supabase integration project (`sbdqmqzgtegemskpewaq`), which
has **zero tables** — confirmed via a reproducible `P2021: table "public.Game" does not exist`.
The schema, migrations, RLS policies, and seed data used throughout this audit all live in a
**different** Supabase project, `wleunpfiokcdbuydkhho`, which is NOT the one wired into Vercel.
**Two separate Supabase projects exist and only one has real data.**
- Waiting on Babs to confirm `wleunpfiokcdbuydkhho` is the intended production database (strong
  signal it is: full `_prisma_migrations` history, real seed data, matches the app's schema) and to
  either retrieve its Postgres connection string from the Supabase dashboard (Project Settings →
  Database) or reset its DB password so a fresh one can be generated.
- Do not change `DATABASE_URL`/`DIRECT_URL` again until that string is confirmed — guessing a
  third time risks another silent misconfiguration.
- Once confirmed: this single fix should resolve 1b, and item 2 (auth) partially, since
  PrismaAdapter was hitting the same empty database — sign-in was never going to persist users
  even with providers configured.

### 1c. "Trending takes" and "Find your crowd" homepage sections have no empty-state fallback
Smaller, independent bug in `app/page.tsx`: the shared `Section` component just renders
`{children}` with no fallback — add an `EmptyState` like every other section has. Not blocked by
1b, safe to do any time.

## ✅ CONFIRMED / RESOLVED

### SCOUT system — confirmed fully disconnected from the frontend, not just "unclear"
Ran a full repo-wide code search (not just a directory listing) for every term SCOUT writes to its
KV memory — `agent-pulse`, `agent-hunter`, `agent-rivals`, `editorNote`, `breakingNews`,
`hunterBreaking` — and every single one returns **zero matches** anywhere in `app/` or
`components/`. This is now confirmed, not speculative: the 6 SCOUT cron jobs
(`agent-scout`/`agent-pulse`/`agent-social`/`agent-hunter`/`agent-rivals`/`push-notify`) run every
5–30 minutes, call the Anthropic API on most runs, and write real output to Vercel KV that nothing
in the actual product ever reads. This is confirmed dead weight right now, not a maybe — either
build the frontend consumer (banner/personalization the code comments describe) or turn the crons
off; right now it's pure Anthropic API spend with zero user-facing effect. Revisit the
real-athlete-monitoring/auto-posting question (`agent-social.js`) from the same investigation
whenever this gets picked back up — that's a product decision for Babs, not something to build out
further without sign-off.

### 1. `/games`, `/hall-of-flame`, `/communities`, `/debates` hung on the loading skeleton
The infinite-hang symptom is fixed (timeout wrapper + error states in PR #5, awaiting merge), but
see 1b above — the underlying data problem was misdiagnosed as a pooling issue when it's actually
the wrong database entirely. Don't consider this item closed until 1b is resolved.

### 6–8. Supabase performance/security items
Applied via migration on `wleunpfiokcdbuydkhho` (the project with real data): ~23 missing FK
indexes added, ~26 RLS policies rewritten to use `(select auth.<function>())`, RLS enabled on
`_prisma_migrations`. Verified clean via `get_advisors` before/after. These fixes are only useful
once the app is actually pointed at this project (see 1b).

### Create Take — partially verified
`app/api/v1/[...segments]/route.ts` (auth, rate limiting, moderation, fan score) and
`TakeComposer` are well-built and correctly redirect logged-out users to sign-in with a preserved
callback URL — confirmed live. Full logged-in flow still needs a real test account, blocked on
items 1b and 2.

### `api/takes.js` / `api/fan-takes.js` — genuinely dead
Bare `globalThis` storage, no KV, unrelated to SCOUT, not called by the real UI (which uses
`/api/v1/takes`). Safe cleanup whenever convenient.

## CRITICAL

### 2. Auth.js in Production has zero configured providers — CONFIRMED
Claude Code confirmed empirically: `curl https://sideline-wheat.vercel.app/api/auth/providers`
(Auth.js's own introspection endpoint) returns `{}` on production right now. Worse than inert: the
sign-in page's email form calls `signIn("development", ...)` in production, but that provider is
never registered outside dev, so every real submission throws and redirects to `/auth/error`.
**Needs Babs's input on which path to take:** (a) Google OAuth, (b) email magic-link via SMTP, or
(c) both. None implemented yet — all three need real credentials only Babs has. Also blocked on 1b:
fixing providers alone won't produce working sign-in while PrismaAdapter points at an empty
database.

### 2b. Clerk is fully dead code — safe to remove
Confirmed zero references anywhere in the repo, no Clerk dependency in `package.json`. Remove
`CLERK_PUBLISHABLE_KEY` (Vercel env) and the two `https://*.clerk.accounts.dev` CSP entries in
`vercel.json`. Not blocked by anything above, safe to do any time.

### 3. `ADMIN_PASSWORD` env var
Find where it's read; likely should be retired in favor of real moderator roles via
`ModerationAction` (RLS enabled, needs policies per item 5). Not blocked by 1b/2.

## HIGH

### 4. Confirm real vs. seeded sports data source
`BALLDONTLIE_KEY` exists (real API). Only 2 rows in `Game`/2 in `League` in `wleunpfiokcdbuydkhho`
— confirm live-sync gap vs. still-demo-data once 1b is resolved and the app is actually reading
from the right project.

### 5. Three tables have RLS enabled but zero policies
`ModerationAction`, `RateLimitBucket`, `VerificationToken` on `wleunpfiokcdbuydkhho`. Add explicit
policies once item 3's `ADMIN_PASSWORD`→real-roles decision is made.

### 9. Delete `api/takes.js` / `api/fan-takes.js`
See above. Quick cleanup, not blocked.

## MEDIUM — not blocking

### `Session` table has no primary key
Supabase linter flags it as INFO only.

## Next batches (not yet crawled)
Authenticated navigation, full responsive/accessibility passes — all blocked on 1b/2 (need a
working database + working sign-in to test anything requiring a logged-in user).
