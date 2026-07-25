# Phase 1 Audit — Task List for Claude Code

Source: full 30-phase launch-readiness audit spec. Work top to bottom. Do not merge to `main`
without review. Return findings/diffs per item before moving to the next.

## 🚨 NEEDS A FOLLOW-UP FIX — Production is resolved, Preview is not

### 1b. DATABASE_URL/DIRECT_URL point at the WRONG Supabase project — RESOLVED on Production, still broken on Preview
**Production is confirmed fixed.** Independently re-verified live (not just reasoning from env
vars): `curl https://sideline-wheat.vercel.app/games|/debates|/hall-of-flame|/` all now return the
real rows from `wleunpfiokcdbuydkhho` — Detroit Lions/Chicago Bears (LIVE), Boston Celtics @
Detroit Pistons (SCHEDULED), the real "Who has the NFC North's best defense?" debate, a populated
Hall of Flame. This matches exactly what was in the correct project earlier in this audit, so
`DATABASE_URL`/`DIRECT_URL` on the Production target were corrected at some point during this
session (not by Claude Code — most likely Babs, directly in Vercel). Original root cause for
context: `DATABASE_URL` was pointed at Vercel's auto-provisioned Supabase integration project
(`sbdqmqzgtegemskpewaq`, zero tables) instead of `wleunpfiokcdbuydkhho` (the one with real schema,
data, and the item 6–8 migrations).

**Preview is NOT fixed — same bug, different target.** Confirmed via direct request (with the
project's automation-bypass header) against the PR #5 preview deployment
(`sideline-bbqnhj7vm-team-sideline.vercel.app/games`): still renders the "Games are unavailable"
error state (PR #5's own fix correctly surfacing the underlying failure, which is itself a good
sign the fix works — but the underlying DB problem persists on this target). **Action needed:**
apply the same `DATABASE_URL`/`DIRECT_URL` correction to the Preview environment target in Vercel
(Production and Preview can hold different values for the same key — that's very likely why only
one target got fixed). Re-verify both `/games` and `/debates` on a fresh Preview deployment after.

### 1c. "Trending takes" and "Find your crowd" homepage sections have no empty-state fallback
Smaller, independent bug in `app/page.tsx`: the shared `Section` component just renders
`{children}` with no fallback — add an `EmptyState` like every other section has. Fixed in PR #7
(merged).

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

## PHASE 1 — SITE CRAWL AND INTERACTION AUDIT (complete, verified)
Full Playwright crawl (system Chrome, sandboxed Chromium download never completed) of 23 routes on
Production, logged-out, plus an interactive-element scan of 138 links/buttons across 7 pages, a
375px/1440px responsive spot-check, and a keyboard spot-check on the homepage. Every finding below
was independently re-verified via curl/header inspection or by reading the source, not taken on
the crawl's word alone.

**Route inventory: all 23 routes return correct status codes.** Zero 500s, zero dead routes, zero
broken image/asset requests. All 5 auth-gated routes (`/arena`, `/settings`, `/notifications`,
`/moderation`, `/onboarding`) correctly redirect logged-out visitors to `/auth/sign-in` with
`callbackUrl` preserved. Authenticated-state crawling remains impossible on any live deployment
(item 2 — zero providers) — every gated route's *only* testable behavior right now is that the
redirect fires correctly, which it does.

**Interactive elements: zero broken links/buttons found** across 138 scanned elements (no dead
`href="#"`, no `javascript:void`, no falsely-disabled controls). **Zero horizontal overflow**
across 10 viewport/page combinations at 375px and 1440px. **Keyboard nav is clean** on the
homepage — logical tab order, visible focus on every stop, no traps.

**Fixed in draft PR #7 (`claude/phase1-audit-followups`, awaiting review/merge):** the High finding
below, all three Medium findings, the Low CSP finding, item 2b, and 1c. Item 3 investigated, not
changed (see below). Verified: typecheck/lint/build/vitest all clean; sign-up-copy and not-found
changes manually smoke-tested against a local dev server.

### High: `/auth/sign-up` silently redirects to sign-in with sign-in copy
Confirmed via source (`app/auth/sign-up/page.tsx`): it's an unconditional
`redirect("/auth/sign-in?callbackUrl=/onboarding")`, no distinct sign-up page exists at all. A
browser following this (confirmed via Playwright) lands on a page reading "Welcome back" / "Return
to your games, communities, and fan identity" — shown to brand-new visitors who clicked "Join
FanTakes." This may be intentional (passwordless email-link auth doesn't need a separate form —
same action for new or returning users), but the copy is actively wrong for that case. Cheapest
fix that doesn't wait on the item 2 auth-provider decision: make the sign-in page's copy neutral
when arrived at via a signup-intent path (e.g. check `callbackUrl=/onboarding` or add a `?new=1`
param from the "Join"/"Create a fan profile" links) instead of unconditionally "welcome back."

### Medium: auth-gate redirect crosses origins when accessed via the `.vercel.app` host
Confirmed via response headers: `curl -D- https://sideline-wheat.vercel.app/arena` returns
`Location: https://www.fantakes.app/auth/sign-in?callbackUrl=%2Farena` — a different origin than
the one the request came in on. `proxy.ts` builds the redirect from `request.nextUrl.origin`, which
should be same-origin; something (likely `AUTH_URL` normalization inside the `auth()` wrapper, or a
platform-level canonical-domain behavior) is forcing it to the custom domain regardless of request
host. Practical effect: Next's `<Link>` prefetching for `/arena`/`/settings` (visible in the sidebar
in every auth state) fires a cross-origin fetch that fails CORS preflight, logging a real, visible
console error on almost every page (confirmed on `/`, `/games`, `/games/[id]`, `/debates`,
`/communities`, `/hall-of-flame`, `/search`, `/users/[handle]`). Doesn't block real navigation
(full-page loads still redirect correctly), but it's a reproducible error Phase 1 explicitly asks
to catch. Needs investigation into why `nextUrl.origin` isn't respecting the request host inside
`proxy.ts`/`auth()` before picking a fix.

### Medium: invalid game IDs render the generic, unstyled Next.js not-found page
`/games/<invalid-uuid>` falls through to the global "404: This page could not be found" with no app
shell styling, no branded copy, no way back to `/games`. Add a route-level `not-found.tsx` for
`app/games/[gameId]/` (call `notFound()` when the game lookup returns null) so it matches the rest
of the product.

### Medium: several routes are missing per-page `<title>`/metadata
`/games/[gameId]`, `/debates`, `/communities`, `/hall-of-flame`, `/search` all render the generic
`<title>FanTakes</title>` instead of something like "Chicago Bears @ Detroit Lions | FanTakes."
(`/games` itself already does this correctly — "Games | FanTakes" — so there's a working pattern to
copy.) Minor for users, bad for bookmarks/tabs/SEO/social sharing.

### Low: Preview's CSP blocks Vercel's own review-feedback widget
`vercel.live/_next-live/feedback/feedback.js` is blocked by the CSP `script-src` on Preview
deployments (doesn't allow `vercel.live`). Preview-only, doesn't affect real users, breaks Vercel's
built-in PR review tooling. Add `https://vercel.live` to `script-src` (and likely `connect-src`) in
`vercel.json` alongside the item 2b Clerk-CSP cleanup.

## PHASE 2 — AUTHENTICATION AND ACCOUNTS (complete, verified)
Full checklist audit of `auth.ts`, `proxy.ts`, `app/auth/*`, `app/(app)/onboarding/page.tsx`,
`app/api/v1/[...segments]/route.ts`'s auth-touching endpoints, and `prisma/schema.prisma`'s
User/Account/Session/Profile models. See item 2 above for the auth-provider findings (the big news
from this phase); this section covers everything else.

**Fixed in draft PR #9 (`claude/phase1-audit-phase2`, awaiting review/merge):** onboarding's
`User.handle` unique-constraint collision wasn't caught in either the onboarding page's Server
Action or its JSON-API twin (`POST /api/v1/profile/complete`) — the page threw unhandled, the API
returned an opaque generic 500 instead of a specific "handle taken" error. Both now catch Prisma's
`P2002` and return a clear, actionable message. Also fixed a casing inconsistency (API path stored
`handle` with original casing while `normalizedHandle` was lowercased; both now lowercase
consistently).

**Audited, confirmed already correct — no change needed:**
- Session persistence, `callbackUrl` propagation through sign-in, and sign-out are all correctly
  wired (`components/profile/account-danger-zone.tsx`, `app/(app)/settings/page.tsx`).
- `ENABLE_DEV_AUTH`'s production guard in `lib/env.ts` uses Vercel's own `VERCEL_ENV` — solid,
  can't be spoofed by a user-set env var.
- Google button correctly stays hidden when unconfigured; NextAuth route handler
  (`app/api/auth/[...nextauth]/route.ts`) is correctly wired for whenever a provider works.
- **No password field exists anywhere in the app** — confirmed via grep, `bcryptjs` (a real
  dependency in `package.json`) is unused dead code. Auth is entirely passwordless
  (OAuth/email-link/dev-credentials) by design, so the spec's "password recovery" checklist item
  doesn't apply to this app's actual auth model — documenting that plainly rather than treating it
  as a gap.
- Duplicate-email-across-providers is handled by Auth.js's own secure-by-default behavior (no
  `allowDangerousEmailAccountLinking` set) — not custom code, not a gap to fix.
- A relevant Playwright test already exists — `tests/e2e/authenticated-database.spec.ts` (DB-gated
  via `RUN_DATABASE_E2E`) — covering sign-in, session-persists-after-refresh, and sign-out. Its
  assertions would have caught the pre-`trustHost` redirect bug described in item 2. Didn't
  duplicate it with a new test since it already covers this ground correctly.

**Verification depth, stated plainly:** typecheck/lint/build/vitest are all clean. The
duplicate-handle fix and the auth-redirect/Google-OAuth findings above were verified against a real,
fresh Preview deployment via direct HTTP requests (CSRF token fetch + real POST to
`/api/auth/callback/development`, and a real Google OAuth-initiation request) — not assumed from
reading code. Did not and could not complete a full real Google OAuth consent flow (requires
interactive browser + a real Google account) — the Client ID/Secret finding was caught at the
initiation-redirect step, before that would even be reachable.

## CRITICAL

### 2. Auth.js — real progress, one live blocker left, needs Babs to check Google Cloud Console
Status has moved a lot since the original "zero providers" finding, tracked here in order:

- **Dev credentials on Preview (PR #6, merged) — confirmed fully working end-to-end.** Re-tested
  live against a fresh Preview build of current `main`: got a real `db.user.findUnique` hit, a
  valid session cookie, and (after PR #7's `trustHost: true`) a correct same-origin redirect to
  `/arena`. This is genuine, verified, working authenticated access on Preview — the biggest
  concrete auth win of this audit. Confirmed blocked on Production by design (`lib/env.ts` guards
  `ENABLE_DEV_AUTH` off whenever `VERCEL_ENV === "production"`, using Vercel's own non-spoofable
  env var) — that's correct and intentional, not a gap.
- **Real Google OAuth credentials now exist in Vercel** (`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`,
  both Preview + Production targets, added very recently — not by Claude Code). This is new since
  the original finding above.
- **🔴 But they're misconfigured — confirmed live, not fixed.** Triggered a real OAuth-initiation
  request against a fresh Preview deployment; Google's own redirect URL shows
  `client_id=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`. That `GOCSPX-` prefix is the distinctive format
  of a Google OAuth **Client Secret** — real Client IDs always end in `.apps.googleusercontent.com`.
  `auth.ts`'s code is correct (`clientId: AUTH_GOOGLE_ID`, `clientSecret: AUTH_GOOGLE_SECRET` — no
  bug there); the value stored in `AUTH_GOOGLE_ID` itself is wrong. **This will fail at Google with
  an invalid-client error for any real user who tries it right now.** Needs Babs to check Google
  Cloud Console's OAuth client (Credentials page) against what's actually in Vercel — most likely
  `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` got swapped, or `AUTH_GOOGLE_ID` was set to the wrong
  value entirely. Not something to guess-fix without the real correct value.
- Email magic-link (SMTP/`EMAIL_SERVER`) is still entirely unconfigured — untouched since the
  original finding, still an open option alongside/instead of Google OAuth.
- 1b's DB-project mismatch no longer blocks this on Production (see above, resolved there) but
  **still blocks real user creation via any provider on Preview** until 1b's Preview fix lands too.

### 2b. Clerk — DONE
Correction: Clerk does still appear in the repo (legacy root-level `index.html`/`login.html`/
`onboarding.html`/`script.js`/`api/config.js`), contrary to the original "zero references" claim —
but all of those pages are confirmed unreachable (404) under the current Next.js-framework Vercel
deployment, so the original "safe to remove" conclusion holds for the live product. Done:
`CLERK_PUBLISHABLE_KEY` removed from Vercel (both targets), the two `*.clerk.accounts.dev` CSP
entries removed from `vercel.json` in PR #7. The legacy files themselves are untouched — that's
part of the broader legacy-static-site question below, not this item specifically.

### 3. `ADMIN_PASSWORD` env var — investigated, not changed
Only gates the legacy `admin.html` panel via `api/admin-auth.js`/`api/articles-store.js` — unrelated
to the real app's `ModerationAction` table entirely. `admin.html` itself 404s in Production (the
Next.js framework build doesn't serve root-level static HTML), so this is currently unreachable —
same "dead but the API endpoint behind it is still live and callable" pattern as 2b. Not deleted
here; folding into the standing legacy-cleanup decision below rather than a one-off removal.

### Standing decision needed: what to do with the whole legacy static site + API layer
Beyond Clerk and `ADMIN_PASSWORD`: `index.html`, `script.js`, `login.html`, `onboarding.html`,
`admin.html`, `blog.html`, and their backing `api/*.js` serverless functions (`config.js`,
`admin-auth.js`, `articles-store.js`, `takes.js`, `fan-takes.js`, and more) are a full parallel
legacy product living in the same repo as the real Next.js app. The HTML pages are confirmed
unreachable (Vercel's `framework: nextjs` build doesn't serve root-level static files), but the
`api/*.js` functions deploy independently of that and several are confirmed still live and callable
right now (`/api/config` returns 200 with the — now removed — Clerk key; presumably others too).
This is dead weight at best and unnecessary live attack surface at best-case-not-dead (e.g.
`/api/admin-auth` is a real, callable, rate-limited password-guess endpoint with no UI in front of
it). Worth an explicit call from Babs: delete the whole legacy layer, or is any of it still needed?

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
Phase 1 (logged-out crawl) is complete — see the PHASE 1 section above. Authenticated navigation,
full Phase 23 accessibility audit (axe scans), and full Phase 24 responsive matrix are still
pending — authenticated coverage is blocked on item 2 only now (DB is fixed on Production), the
others are just not yet run.
