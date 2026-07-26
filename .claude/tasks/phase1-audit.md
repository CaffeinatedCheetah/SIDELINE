# Phase 1 Audit — Task List for Claude Code

Source: full 30-phase launch-readiness audit spec. Work top to bottom. Do not merge to `main`
without review. Return findings/diffs per item before moving to the next.

## ✅ 1b — NOW FULLY RESOLVED on both Production and Preview

### 1b. DATABASE_URL/DIRECT_URL pointed at the wrong Supabase project — fixed everywhere
**Both targets confirmed fixed, independently re-verified live.** Production: `curl
https://sideline-wheat.vercel.app/games|/debates|/hall-of-flame|/` all return rows from
`wleunpfiokcdbuydkhho` (the correct project). Preview: during Phase 8's authenticated testing,
signed in as `demo@fantakes.local` on a freshly deployed Preview build, POSTed a real take, and a
fresh GET immediately showed it — a real write + read round-trip against the correct database,
not just an env-var check. `vercel env ls` also confirms `DATABASE_URL`/`DIRECT_URL` now target both
`production` and `preview` with a recent `updatedAt`. Original root cause for context: `DATABASE_URL`
was pointed at Vercel's auto-provisioned Supabase integration project (`sbdqmqzgtegemskpewaq`, zero
tables) instead of `wleunpfiokcdbuydkhho` (the one with real schema, data, and the item 6–8
migrations).
**Correction to how this was originally described:** "Detroit Lions/Chicago Bears (LIVE)" etc. are
**not real sports data** — they're `prisma/seed.ts` fixture rows (`providerRef: "demo-nfl-live"`).
1b's fix means the app is now correctly reading the right *database* — it says nothing about whether
that database's game content is real, which it isn't. See item 4 (Phase 4) for the full finding.

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

## PHASE 3 — GLOBAL NAVIGATION AND APP SHELL (complete, verified)
Audited `components/navigation/app-shell.tsx` (desktop sidebar), `navbar.tsx` (top nav + mobile
bottom nav), `footer.tsx`, `shell-gate.tsx`, and `app/layout.tsx`. Found two real, load-bearing bugs
— both fixed in draft PR #10 (`claude/phase1-audit-phase3`, awaiting review/merge).

### High: the navbar never reflected real session state, for anyone, on any page
`app/layout.tsx` rendered `<Navbar />` with **zero props**. `authenticated`/`unread` default to
`false`/`0` in the component, so every real signed-in user saw a fully logged-out navbar the entire
time they were signed in: no Take button, no notification bell/unread count, no My Arena link — and
the mobile bottom nav's Take/Alerts/Profile slots all pointed at `/auth/sign-in` instead of their
real destinations. This means even now that item 2's dev-auth-on-Preview is confirmed genuinely
working end-to-end, a real tester signing in would still see a broken-looking, always-logged-out
navbar throughout their whole session. Fixed: `RootLayout` is now an async Server Component calling
`auth()` + a notification unread-count query (same pattern already used in
`app/(app)/notifications/page.tsx`), passing real values down to `Navbar`.

**Tradeoff, stated explicitly:** `auth()` reads cookies, which forces the whole route tree dynamic.
Confirmed via build output diff: `/help`, `/terms`, `/privacy`, `/guidelines`, `/auth/sign-up`,
`/auth/error`, and `/_not-found` flip from statically prerendered to server-rendered-per-request. A
broken navbar for every authenticated user clearly outweighs losing static generation on 7
low-traffic marketing/legal pages, but flagging this as a real, deliberate cost rather than a silent
regression — a Suspense-based streaming refactor to recover static generation there is a reasonable
Phase 25 (Performance) follow-up, not attempted here.

### High: the mobile "Open menu" hamburger button did nothing
Confirmed via a repo-wide search: no `onClick`, no menu component, nothing wired to it at all. Since
the primary nav bar (Games/Debates/Communities/Hall of Flame) is hidden below the `lg` breakpoint and
the 5-slot mobile bottom nav only covers Home/Games/Take/Alerts/Profile, **Debates, Communities, and
Hall of Flame were completely unreachable via any control on mobile/tablet viewports** — a direct,
concrete violation of "no item is hidden without an alternative pathway." Fixed by wiring the button
to the existing `Modal` component (the same pattern already used for the "Create a take" trigger two
lines below it in the same file) showing the previously-hidden destinations plus Settings when
authenticated. Added a unit test asserting the menu exposes all three with correct hrefs.

### Audited, confirmed clean — no changes needed
Desktop sidebar: every destination routes correctly, active-state highlighting works, all hrefs are
real routes. Footer: all 4 links (Help, Community guidelines, Privacy, Terms) are real, working
routes. Phase 1's interactive-element scan (138 elements, zero broken) already covered general
link-checking for logged-out state; these two Phase 3 bugs are specifically about auth-state wiring,
which a logged-out-only crawl couldn't have caught.

**Verification:** typecheck/lint/build/vitest all clean (28/28 unit tests). Confirmed the
static→dynamic tradeoff by diffing the build's route table before/after the fix, not assumed.

## CRITICAL

### 2. Auth.js — FULLY RESOLVED. Real sign-in works end-to-end now.
Status, tracked in order of how it actually got fixed:

- **Dev credentials on Preview (PR #6, merged) — confirmed fully working end-to-end.** Real
  `db.user.findUnique` hit, valid session cookie, correct same-origin redirect to `/arena`.
  Confirmed blocked on Production by design (`lib/env.ts` guards `ENABLE_DEV_AUTH` off whenever
  `VERCEL_ENV === "production"`) — correct and intentional, not a gap.
- **Google OAuth — confirmed genuinely fixed, live.** The previous finding (Client ID/Secret
  swapped — `AUTH_GOOGLE_ID` held a value with the `GOCSPX-` prefix, which is a Client *Secret*'s
  format) is resolved: re-triggered a real OAuth-initiation request against Production and got
  `client_id=1058548997770-0tbsjsh6vb6qofh2jejf97ab06n3eeg7.apps.googleusercontent.com` — the
  correct format this time. `vercel env ls` confirms both `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
  have an `updatedAt` well after their `createdAt`, consistent with a real fix, not a new pair.
  (Could not complete the full interactive Google consent screen — that needs a real Google account
  in a real browser — but the initiation step, which is where the previous bug lived, is fixed.)
- 1b's DB-project mismatch (see above) is now resolved on both Production and Preview, so real user
  creation via any provider works on both targets — verified via Phase 8's real authenticated
  write+read round-trip on Preview.
- Email magic-link (SMTP/`EMAIL_SERVER`) remains unconfigured — no longer needed now that Google
  OAuth works, but still an open option if a second sign-in path is ever wanted.

**Net effect: auth is no longer a blocker for anything in this audit.** Phase 8 onward is the first
work in this audit tested with a real authenticated session end-to-end.

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

## PHASE 4 — REAL SPORTS DATA

**Babs's direction after the initial audit: follow the roadmap's documented adapter architecture,
get the Games tab showing real games/scores, don't fabricate.** Built it — draft PR #11
(`claude/phase1-audit-phase4`). **Currently blocked on a working `BALLDONTLIE_KEY`, not on code.**

### Built: `lib/sports/provider.ts` / `balldontlie.ts` / `sync.ts`
A `SportsProvider` interface (matches `docs/ROADMAP.md`'s "provider-neutral game adapter" framing —
a future provider swap won't touch call sites), a real `BallDontLieProvider` implementation against
balldontlie.io's actual documented NBA/NFL endpoints (verified against their live docs, not
memory), and a sync function that upserts real games into the existing `Team`/`League`/`Game`
tables — not a separate live-only data path — so takes/debates/predictions keep working against real
games via the schema's normal foreign keys.

**No cron used, deliberately:** this project is on Vercel's Hobby plan, where crons only run daily
(`666d204 fix: reduce crons to daily for Vercel Hobby plan`) — useless for live scores. Sync instead
triggers off real page traffic: first request past a 30-second cooldown (reusing the existing
`RateLimitBucket`-backed `checkRateLimit` helper as the gate) fetches fresh data; every request
inside the cooldown just reads the DB. Also keeps requests within the provider's per-minute rate
limit for free.

### 🔴 Blocked: `BALLDONTLIE_KEY` is invalid — confirmed live, not assumed
Deployed the adapter to a real Preview build and tested it against the actual Vercel-injected key via
a throwaway diagnostic route (removed before the final commit — it exposed key-shape info
unauthenticated, not shippable). **Result: 401 Unauthorized on both NBA and NFL**, confirmed three
separate ways (plain header, `Bearer`-prefixed, whitespace-trimmed) specifically to rule out a
client-side formatting mistake before concluding the credential itself is bad. Also found: the stored
value has a stray leading tab character, worth cleaning up regardless once a real key is set.

**This is the third credential this audit has found present-in-Vercel-but-broken**, after the wrong
Supabase project (1b, now fixed) and the swapped Google OAuth Client ID/Secret (item 2, still open).
Worth Babs doing a broader sweep of recently-added credentials generally, not just patching this one
in isolation — three for three so far.

**To finish once a working key exists:** wire `syncTodaysGames()` into `/games` and the homepage,
verify real games render end-to-end, and filter the fabricated seed game (`providerRef` starting with
`demo-`) out of user-facing current/live views so real and fake data don't coexist. Not done yet
because doing it against a confirmed-broken key would just silently do nothing while looking finished
— exactly the failure mode this audit exists to catch, not repeat.

### A bug caught in my own first draft, worth flagging on its own
The first version silently treated a 401 as "no games today" (reasoning: balldontlie licenses
NBA/NFL separately, so a 401 on one league under an otherwise-valid key is a real, expected case) —
but that made a fully invalid key indistinguishable from genuinely-zero-games, the same
swallowed-failure-as-empty-state pattern this whole audit has been removing elsewhere. Caught it via
the raw-response diagnostic before it shipped; now logs loudly on 401/403 instead of returning
silently empty.

**Verification:** typecheck/lint/build clean, 31/31 unit tests passing (4 new, covering the
postponed/scheduled/final/live status mapping — the one piece of pure logic here). Full
integration behavior (real DB upsert, real page rendering) isn't verifiable until the key works.

### Background: why this gap exists (for context, not action — see resolution above)
Short version: there wasn't any live-data code at all, and that turned out to be *documented,
intentional* project scope, not sloppiness — but it collided with where the audit had gotten the
rest of the app by the time this was found.

**No live sports-data integration existed in code, at all, before PR #11.** Confirmed via repo-wide
search:
`balldontlie` (case-insensitive) appears in zero source files — only in this task doc. `BALLDONTLIE_KEY`
(the real env var actually present in Vercel, both targets) doesn't even match the naming convention
the app's own `lib/env.ts` schema expects (`SPORTS_API_BASE_URL`/`SPORTS_API_KEY`), and those two
*are* schema-validated but **never read anywhere else in the codebase** — setting them right now
would do nothing, there's no code path that consumes them. `lib/services/` has no sports-provider
file; `vercel.json`'s crons are all SCOUT-related, none sync Game/League/Team data. The only thing
that has ever populated `Game`/`League`/`Team` is `prisma/seed.ts`, run once.

**This is documented as deliberately deferred, not forgotten.** `docs/ROADMAP.md` explicitly lists
"Named live-data vendor integration beyond the adapter contract" under **Deferred roadmap**, and
describes the current state — "provider-neutral game adapter with deterministic development fixture
data" — as the intended Phase 2 scope (no such adapter abstraction was actually built either, just
the raw seed script). `docs/BUILD_PROGRESS.md`'s "Remaining gaps" section independently confirms:
"Google OAuth, email delivery, and **the sports provider** require external credentials and provider
setup" — the same category as items already known to need Babs's input. `.env.example` documents
`SPORTS_API_BASE_URL`/`SPORTS_API_KEY` as the intended real-data toggle ("leave blank to use
deterministic demo sports data") — aspirational documentation for a switch that was never wired up.

**But: the specific game currently live on Production is fabricated, unlabeled, and being shown to
real users as if genuine — confirmed via `prisma/seed.ts` itself.** The "LIVE" Chicago Bears 14 –
Detroit Lions 17, "3rd quarter, 08:42" game referenced throughout this audit (including my own
earlier "Production is fixed!" note on item 1b) is seed data: `providerRef: "demo-nfl-live"`,
`scheduledAt`/`startedAt` computed relative to whenever the seed script last ran (not real game
time), and the seed script's own closing log line reads `"Seeded FanTakes development data. All
records are demo-only."` The companion "upcoming" NBA game (`demo-nba-upcoming`), the debate, the
takes, and the community are all the same seed batch. This directly conflicts with several explicit,
non-negotiable requirements elsewhere in the spec: "Remove fake 'LIVE' games from user-facing
Production," "Do not show fabricated current scores," "no fake live scores" (Phase 30's minimum
launch bar), and "Platform-generated content must be labeled honestly" (Phase 19).

**The tension worth naming plainly:** deferring live-vendor integration was a reasonable call for a
documentation/foundation-building phase. But this audit has been closing the gaps that stood between
"nobody can reach this app" and "a real user can sign in and use it" — the DB is fixed, dev-auth
genuinely works end-to-end, Google OAuth is one credential-swap away from working. The moment a real
visitor can actually reach the product, a fabricated "LIVE" score with a real-looking clock and
period stops being an acceptable placeholder and starts being something a real user could reasonably
feel misled by.

**Babs's call: build the real integration (option a), following the roadmap's adapter architecture
rather than a quick patch or filtering to empty states.** See the top of this section for what's
built and what's still blocking it (a working `BALLDONTLIE_KEY`). The fabricated seed game is still
live on Production right now, unfiltered, pending that key.

### 5. Three tables have RLS enabled but zero policies
`ModerationAction`, `RateLimitBucket`, `VerificationToken` on `wleunpfiokcdbuydkhho`. Add explicit
policies once item 3's `ADMIN_PASSWORD`→real-roles decision is made.

### 9. Delete `api/takes.js` / `api/fan-takes.js`
See above. Quick cleanup, not blocked.

## MEDIUM — not blocking

### `Session` table has no primary key
Supabase linter flags it as INFO only.

## PHASE 5 — HOMEPAGE FUNCTIONALITY (complete, verified)

Draft PR #12 (`claude/phase1-audit-phase5`). Two categories of finding: dead controls in shared
components (not homepage-specific — used on 5 pages total) and one real data-correctness bug.

### High: `TakeCard`'s flame/reply/share buttons were 100% dead — used on 5 pages
No `onClick` anywhere, styled fully interactive. Confirmed via grep this component is used on the
homepage, `/arena`, `/communities/[slug]`, `/games/[gameId]`, and `/users/[handle]` — a widespread
problem, not a homepage-only one. Fixed: flame now calls the real `POST /api/v1/reactions`
(optimistic + rollback), reply opens the existing `TakeComposer` in reply mode (it already supported
`parentId`, nothing ever passed it), share copies the page link. Removed the "more actions"
(edit/delete/report) button entirely rather than ship a fourth fake one — no report/moderation UI
exists anywhere yet (Phase 17), so there's nothing real to wire it to.

### High: `CommunityCard`'s Join button was dead despite a working component sitting unused
A fully-built `JoinCommunityButton` (real API call, loading/error states) already existed one file
over — `CommunityCard` just never used it, rendering a static `<Button>` instead. Wired it in on
both call sites (homepage, `/communities`), and fixed both to compute the viewer's actual membership
status instead of always defaulting to "not joined."

### High: `ProfileCard`'s Follow button was the same dead pattern
No follow UI exists anywhere in the product — not on this card, not on `/users/[handle]` (confirmed
via search) — despite a real, working `POST /api/v1/follows` backend. Building a full follow flow is
Phase 12's scope, flagged there. Fixed narrowly: the button is now conditional on an `onToggleFollow`
callback prop instead of always rendering, so this component can't ship fake-interactive again.
Nothing currently passes that prop (see next item — why).

### High: homepage "Fan identity" showed a random stranger's data labeled "yours"
The section's copy says "Your ... reputation," but the query fetched whichever user had the most
fan-score events *platform-wide* and showed their real profile to every visitor, logged in or not.
Fixed: shows the actual session's own profile when signed in (no follow button — you can't follow
yourself, which is also why `ProfileCard`'s follow prop goes unused here), and a real sign-up CTA
when logged out, instead of a stranger's real achievements under a "yours" heading.

### Medium: Hero's secondary CTA ignored auth state
"Join FanTakes" showed even to signed-in visitors. Now shows "Go to My Arena" when a session exists.

### Audited, confirmed already correct
`DebateCard` is a summary/results card by design — voting correctly lives on the debate detail page
via the existing `DebateVote` component (confirmed it's actually wired there, not just assumed).
Hall of Flame preview already keeps Rank/Top Take/Fan Score clearly distinct with its own explainer
paragraph — a genuinely good example already in the codebase.

**Verification:** typecheck/lint/build clean, 33/33 unit tests (added a real interaction test —
click the flame button, assert the exact `fetch` call and resulting DOM/aria state, not just a
render check). Deployed to a live Preview and confirmed via direct HTTP fetch against the real
database: homepage returns 200, new labels/button text render correctly, zero stray Follow buttons.

## PHASE 6 — GAMES PAGE (complete, verified)

Draft PR #13 (`claude/phase1-audit-phase6`).

### High: `GameCard` never showed a start time for a game before it had a score
Just a bare clock icon with zero information, on every page that renders it (games list, homepage,
today's schedule). Added a `GameTime` component using `useSyncExternalStore`'s server/client
snapshot split — not a `setState`-in-effect, which this repo's ESLint config correctly rejects as an
anti-pattern — so the viewer sees their *own* local time, not whatever timezone the Vercel runtime
happens to default to. Confirmed via a real render test the actual local-time string appears (e.g.
"Sat, Aug 1, 2:00 PM"), not just that a placeholder exists. **Same latent gap already exists in
`app/games/[gameId]/page.tsx`'s `.toLocaleString()` call** — flagged for whichever phase covers that
page, not touched here to stay scoped to the games list.

### High: team logos never passed through on `/games`
`GameCard` has supported `homeTeamLogo`/`awayTeamLogo` since it was built, and `Team.logoUrl` is a
real fetched field — `/games/page.tsx` just never passed it, even though the sibling
`TodaysScheduleSection` already does this correctly. Wired it through on both.

### High: league filter hardcoded two options instead of querying real data
`<Select>` had exactly `<option>NFL</option>`/`<option>NBA</option>` hardcoded in JSX. Now built from
`db.league.findMany()` — will automatically pick up new leagues once Phase 4's real sync lands
without another code change.

### High: unbounded query, no date window — real scaling problem, not just a UX one
No `take` limit, ordered only by `scheduledAt` ascending — meaning the *oldest* FINAL game ever
synced would render first, ahead of anything live or upcoming, and the list would grow unbounded as
real data accumulates. Added real date navigation (Previous day / Next day / Jump to today, reusing
the same UTC day-boundary convention already established in `lib/db/todays-schedule.ts`) with a
`take: 60` safety cap — matches how an actual sports scoreboard behaves: default to today, browse
other days explicitly. Also added POSTPONED/CANCELED as selectable status filters (schema already
supports both; only LIVE/SCHEDULED/FINAL were offered).

**Nice unintended side effect, confirmed live:** the fabricated seed game's `scheduledAt` (computed
relative to whenever `prisma/seed.ts` last ran, now days in the past) no longer falls inside "today"
under this new date window, so it stopped appearing on `/games` entirely — an honest empty state
instead of the stale fake "LIVE" game, with no special-casing needed. Doesn't change the item 4
finding (the fake game is still live on the homepage's differently-scoped queries and in the DB
itself), but worth noting as a small, real improvement that fell out of the date-window fix.

### A bug caught in my own first draft, worth flagging on its own
Building filter-preserving pagination links via `new URLSearchParams({...filters, date})` silently
stringifies `undefined` values as the literal text `"undefined"` (verified this is real
`URLSearchParams` behavior via `node -e`, not assumed) — would have shipped broken
`?status=undefined&league=undefined` URLs on every date-navigation click whenever no filter was
active, which is the common case. Caught it before committing; replaced with a small helper that
drops empty values before building the query string.

**Verification:** typecheck/lint/build clean, 34/34 unit tests (2 new, covering team-logo rendering
and the real local-time string). Deployed to a live Preview and confirmed via direct HTTP fetch
against the real database.

## PHASE 7 — GAME ROOM (complete, verified)

Draft PR #14 (`claude/phase1-audit-phase7`). Cross-checked every finding against the project's own
design spec (`docs/pages/GAME_ROOM.md`), not just my own read of the code — the doc turned out to
settle several of these decisively rather than leaving them to my judgment.

### High: Chat, Stats, Highlights tabs — removed, not relabeled
All three rendered unconditionally with copy ("... is quiet. Live updates appear here when
available.") implying a working feature with no current data, for every game, forever. The design
doc's documented section order has no chat/stats/highlights anywhere — confirmed these were never
part of the plan, not a build-in-progress. Removed rather than relabeled: there's nothing real behind
them to honestly call "coming soon."

### High: Play-by-play tab — removed per the design doc's own explicit condition
The doc says play-by-play should be "shown only if the provider adapter supplies verified data; it is
not synthesized." No provider currently supplies this (not even Phase 4's real adapter fetches it),
and there's no schema field to store it if it did. Removed for now rather than ship a
permanently-empty tab; reintroduce once a provider with play-by-play support exists, per the doc's
own stated condition.

### High: poll voting was completely fake
`PollCard` was rendered with `disabled` hardcoded, no `onChange`/`onVote` — despite the component
fully supporting both and a real, working `POST /api/v1/poll-votes` endpoint already existing
(closesAt check, duplicate-vote handling). Built `PollVoteCard` to wire them together, plus a real
per-viewer "did I already vote" check so a returning voter doesn't see the poll as fresh again.

### High: `LiveGameRoom` polled the real endpoint every 15s but only showed a status label
Correctly matches the design doc's "poll every 15 seconds" spec, but only ever extracted `status`
from the response — the actual score/period/clock shown in the page header were rendered once from
the initial server request and frozen for the rest of the session, even though the same poll response
already contains fresh values for all of them. Fixed to track and render the full live scoreboard,
and to stop polling once the live-tracked status leaves LIVE (previously it would poll a finished
game forever). `PageHeading`'s description is now skipped for LIVE games (`LiveGameRoom` owns that
display) and shows the real final score for FINAL games instead of just the scheduled time. Made
`PageHeading`'s `description` prop optional rather than pass an empty string to satisfy a required
prop that didn't need to be one.

**Verification:** typecheck/lint/build clean, 36/36 unit tests (3 new — real poll-vote API call +
resulting disabled state, live scoreboard shows the real score/period/clock, and renders nothing at
all for a non-live game). Deployed to a live Preview and confirmed via direct HTTP fetch against the
real database: Chat/Stats/Highlights/Play-by-play are completely gone from the rendered HTML, and the
live scoreboard shows the real `14–17 · 3rd 08:42 · LIVE · connected` — not the old static
status-only line.

## PHASE 8 — CREATE TAKE (complete, verified)

Draft PR #15 (`claude/phase8-create-take`). First phase tested with a genuinely real authenticated
session end-to-end — signed in as `demo@fantakes.local` against a live Preview deployment, now that
both dev-auth-on-Preview and Google OAuth are confirmed working (see item 2 above).

### High: newly posted takes never appeared without a manual page reload
Root cause confirmed via a real POST + fresh GET round-trip: the take persists correctly and
attaches to its game/debate/community correctly — the DB/API layer is entirely correct. The bug is
purely client-side: `TakeComposer` never called `router.refresh()` after a successful post, unlike
the sibling `DebateComposer`, which already does exactly this. Every page rendering `TakeComposer`
(game room, debate detail, community detail) fetches its take list via a Server Component, and
Next's App Router doesn't refetch that tree just because an unrelated client fetch succeeded
elsewhere. Fixed by adding the same `router.refresh()` call `DebateComposer` already uses.

### Verified live against the real API, not just read from source
- Posting to a community you're not a member of correctly returns `403 FORBIDDEN` with a message
  `TakeComposer` correctly surfaces.
- Empty body and >1000-char body both correctly rejected server-side (`400 INVALID_REQUEST`),
  independent of the client's `maxLength`/`required` — real defense in depth, confirmed live.
- Duplicate-submission prevention (button disables synchronously via `loading` state) and Modal
  open/focus-trap/Escape (generic Radix Dialog behavior, already covered by
  `tests/unit/modal.test.tsx`) both hold — no changes needed.
- Logged-out entry points: navbar's "Create a take" trigger is entirely absent when logged out
  (both desktop and mobile); page-embedded composers render unconditionally but correctly redirect
  to `/auth/sign-in` with the return URL preserved on a 401 if a logged-out visitor submits — matches
  the explicit requirement.
- Test take posted during verification was deleted from the database afterward — no leftover test
  data left behind.

### Found, not fixed here — flagged for Phase 11 (Search)
`components/search/search-panel.tsx` links take results to `/takes/${id}`, a route that doesn't
exist anywhere in the app — confirmed via search, no `app/takes/` directory exists. Cross-checked
against `docs/pages/SEARCH.md`, which explicitly states "Authored take full-text search is deferred
pending privacy/moderation review" — Search including takes at all, and linking to a nonexistent
permalink, is itself out of spec, not just a missing page. Left for Phase 11 to keep this PR scoped
to Create Take's own files.

**Verification:** typecheck/lint/build clean, 38/38 unit tests (1 new regression test asserting
`router.refresh()` is actually called after a successful post, not just that the request fires).

## PHASE 9 — DEBATE CENTER (complete, verified)

Draft PR #16 (`claude/phase9-debate-center`). Cross-checked every finding against
`docs/pages/DEBATE_CENTER.md`.

### High: voting was permanent — no way to ever change your position
`db.vote.create` (not `upsert`) meant a second vote on the same debate always hit the unique
constraint and returned a hard 409 for life. The doc explicitly says "position selection via PUT" —
changeable. Fixed via `db.vote.upsert` on `(userId, debateId)`, matching the sibling take-vote branch
in the same handler which already did this correctly. Wired the debate detail page to look up the
viewer's existing vote and pass it to `DebateVote`, which now shows "Your position," lets you pick a
different option, and calls `router.refresh()` after voting — `DebateVote` had the exact same
missing-revalidation bug Phase 8 found and fixed in `TakeComposer`.

**Verified live, not just read from source:** cast a vote, changed it, confirmed the *same* vote row
updated in place (`total` stayed at 1, not 2) and percentages flipped correctly. Test votes deleted
afterward.

### High: only ever 2-position debates were creatable
`DebateComposer` had exactly two hardcoded `option1`/`option2` inputs. The doc's own "Assumptions and
decisions" section states debates support 2–4 positions, and the server already validated up to 6 —
the actual product feature existed everywhere except the only UI that creates debates. Rebuilt the
composer with add/remove position rows capped at the doc's stated 4, and tightened the server's
`.max()` from 6 to 4 to match.

### High: no tabs, no filters, no featured section at all
Just a flat list of every OPEN debate, newest first — meaning LOCKED/ARCHIVED debates were completely
unreachable, no page ever queried for them. Implemented the doc's exact spec: Active/Closing
soon/Resolved tabs backed by real `DebateStatus`/`closesAt` fields, a community filter, and a
non-auto-rotating featured debate (highest total votes, deterministic tie-break). Verified live: the
real seed debate correctly shows as Featured on Active, and Resolved correctly shows an honest empty
state (no debate has ever been locked/archived).

### Discrepancy flagged, not silently decided
The original Phase 9 brief asked for Popular/Latest/Trending/Unanswered tabs. The project's actual
design doc specifies Active/Closing soon/Resolved instead, backed by real schema fields — no
"popularity" or "unanswered" concept exists anywhere in the data model. Implemented the documented
version; flagging this explicitly rather than picking silently. Redo as
Popular/Latest/Trending/Unanswered if that's actually what's wanted over the documented spec.

### Found, not built: no debate edit/delete exists for anyone
Confirmed via the API route's full PATCH/DELETE handlers: only `takes/:id`, `profile`, and `account`
are supported — nothing for debates, for creators or moderators. The design doc doesn't call for
creator self-edit either, and `Debate` has none of `Take`'s soft-delete/edit-window schema support
(`editedAt`, `deletedAt`, `AUTHOR_REMOVED` status). This needs a product decision (can you edit after
votes exist? does editing reset votes?), not a code fix — flagged for Phase 17 (Moderation) alongside
the lock/archive lifecycle moderators would actually need.

### Take vs Debate — documented, as the phase explicitly asked
A **Take** is a short (≤1000 char) freeform opinion, optionally attached to a game/debate/community/
parent-take, supports FIRE reactions and threaded replies, no formal resolution. A **Debate** is a
structured question with 2–4 predefined positions the community votes on (one changeable vote per
person), has an open/locked/archived lifecycle with an optional close time, and can carry freeform
Takes as "counter-takes" — evidence/commentary that never affects the vote tally.

**Verification:** typecheck/lint/build clean, 40/40 unit tests (3 new: add/remove positions capped at
4, change-position flow, vote-refresh regression).

## PHASE 10 — COMMUNITIES (complete, verified)

Draft PR #17 (`claude/phase10-communities`). Cross-checked against `docs/pages/COMMUNITIES.md`
(directory) and `docs/pages/COMMUNITY_DETAIL.md` (detail page).

### High: community detail had the same fake-tab pattern already removed from Game Room
`chat`/`polls`/`events`/`media` rendered unconditionally with generic "will appear here" copy,
forever, for every community — none of these four are in the documented tab list
(Feed/Games/Debates/Members/About). Removed them, same treatment as Phase 7's Game Room finding.

### High: Debates and Members tabs were missing despite being fully buildable
`Debate.communityId` is a real FK (a real debate is already attached to the seed community) and
`CommunityMember` has real role/user data — built both as real tabs instead of fake placeholders.
Flagged, not built: a "Games" tab per the doc — `Community` has no team/league/game relation
anywhere in the schema, so nothing could populate it without a schema change.

### High: `Community.avatarUrl` existed and was never rendered anywhere
Same "real data column nobody reads" pattern this audit keeps finding. Added it to the detail hero.

### Medium: joining silently recorded rule acceptance without ever showing the rules
`rulesAcceptedAt` was stamped on join, but the user never saw the rules text first — a timestamp for
consent that was never presented isn't real consent, and the doc requires "rule acceptance." Added an
optional confirmation step to `JoinCommunityButton` (reuses the existing `ConfirmationDialog`)
showing the real rules before joining, wired in on the detail page. Left the compact directory/
homepage card's one-click join unchanged — a deliberate scope line, not an oversight.

### High: the directory was a flat, unsorted list — no tabs, filters, or featured section
Implemented the doc's Trending/Most active/New tabs (Trending approximated as 7-day take velocity,
since there's no dedicated activity field) plus a featured community (highest member count,
deterministic, non-auto-rotating — matching Phase 9's debate-center featured pattern). Flagged, not
built: "Browse by team/league chips" — same schema gap as the Games tab.

### Discrepancy flagged, not silently decided
The original brief asked for "My Communities / Discover" tabs. The actual doc specifies Trending/Most
active/New for the public directory; a separate "Your Communities" view belongs to My Arena (Phase 13)
— two different pages in the documented design, not one.

### Confirmed already correct
Community creation is deferred by explicit design-doc decision ("never tease an unusable flow") —
confirmed via search that no Create Community UI exists anywhere. Compliance, not a gap.

### 🔍 Found live during verification, not built: the community owner never appears in its own Members list
Deployed to a live Preview and fetched the community detail page's real data: the actual owner
(`ownerId`) never showed up in the Members tab at all. Seed data only ever created a
`CommunityMember` row for a regular member — never one for the owner. `Community.ownerId` and
`CommunityMember` role=OWNER are two structurally separate things in this data model right now, and
nothing guarantees they're kept in sync. A real owner visiting their own community wouldn't see
themselves listed. Worth a decision: should creating/owning a community always also create an OWNER
`CommunityMember` row? Not patched blind here — needs a call on intended behavior, and possibly a
data-backfill for the existing seed community.

Also found, not built: "Leave uses confirmation if the user has a role" (doc) — `JoinCommunityButton`
doesn't know the viewer's role yet, so a moderator/owner leaving gets no extra confirmation warning.
Scoped out of this PR (needs role plumbed into the component).

**Verification:** typecheck/lint/build clean, 39/39 unit tests (1 new: rules-confirmation-before-
joining flow, asserting the request doesn't fire until confirmed). Deployed to a live Preview and
confirmed via direct HTTP fetch against the real database: tabs/featured section render correctly,
fake tabs are completely gone, Debates tab shows the real debate with real vote percentages and the
wired `closesAt`, avatar falls back to initials correctly.

## PHASE 11 — SEARCH (code complete, PR/live-verify blocked on tooling — see below)

Branch `claude/phase11-search`, pushed. Cross-checked against `docs/pages/SEARCH.md`.

### High: search returned dead-end take links and a declared-but-never-queried games key
`app/api/v1/[...segments]/route.ts`'s `resource === "search"` handler queried `takes`, which the doc
explicitly defers ("Authored take full-text search is deferred pending privacy/moderation review") —
this is the exact dangling `/takes/${id}` link flagged, not fixed, in Phase 8 (no `app/takes/` route
exists at all). It also queried `teams`, which have no `/teams/[key]` destination route anywhere
(confirmed via search) — another dead-end link. Meanwhile `games` was already declared in the
endpoint's empty-fallback response shape but never actually queried — the same
declared-but-unbuilt pattern this audit keeps finding elsewhere. Fixed: removed takes/teams, built
the real games query (home/away team name/abbreviation match), and added `type`-based filtering
(all/games/debates/communities/people) plus the doc's 100-char query cap.

### High: search UI had no URL state, no type filters, no recent searches, no empty/loading states
`components/search/search-panel.tsx` and `app/(app)/search/page.tsx` rewritten: query and type now
live in the URL (refresh and back/forward preserve results, per the brief), a debounced live preview
runs client-side while a submit (Enter/button/recent-search click) is what commits to the URL and
history, tab filters show real result counts, and there's a proper loading skeleton plus a
distinct no-results state. Recent searches persist in `localStorage` with a Clear control. Added
`robots: { index: false, follow: true }` and a canonical of bare `/search` per the doc ("Page and all
query variants use noindex; canonical is /search without query").

### Added: pg_trgm GIN indexes for the searched text columns
Confirmed via Supabase (`list_extensions`) that `pg_trgm` is available on `wleunpfiokcdbuydkhho` but
not installed, and `prisma/schema.prisma` has no `previewFeatures` enabling extended index types — so
this is a raw-SQL migration (`prisma/migrations/202607260001_search_trigram_indexes/`), not a schema
change, matching how the `RateLimitBucket` index in `202607240001_preview_hardening` was already done
as a plain migration. Covers `User.displayName`/`handle`, `Team.name`/`abbreviation`,
`Community.name`, `Debate.title` — the exact columns the ILIKE/`contains` queries above hit.

### 🔴 Blocked, tooling not code: migration not yet applied to the live database
This session's auto-mode classifier denied direct `apply_migration` against the live Supabase project
(schema change to a shared database — correctly treated as needing explicit sign-off, not a
workaround target). The migration file is committed and will run correctly via the normal
`prisma migrate deploy` path whenever that's wired into deploys, or can be applied manually. Until
then, search still works — the trigram indexes are a performance optimization for
`contains`/ILIKE queries at scale, not a correctness dependency.

### 🔴 Blocked, tooling not code: no draft PR opened, no live-Preview verification done
Unlike Phases 5–10, this phase could not be verified against a live Preview deployment or shipped as
a draft PR: the Vercel MCP connector disconnected mid-session (session-expired, then dropped from the
available tool list entirely) and this environment has no `gh` CLI installed and no accessible GitHub
token (`git credential fill` was correctly denied by the same classifier as a credential-extraction
pattern, which is the right call — did not attempt to work around it). The branch is pushed;
GitHub's own push output includes the PR-creation link:
`https://github.com/CaffeinatedCheetah/SIDELINE/pull/new/claude/phase11-search`. Needs either a human
to open that link, or a retry once Vercel MCP/GitHub tooling is available again in a future session.

**Verification, stated plainly given the above:** typecheck/lint/build all clean. `npm run test`
clean (40/40, no regressions from the rewrite). Added integration coverage
(`tests/integration/database-flows.test.ts`) for type-scoped filtering, the 2-char query floor, and
the takes-exclusion — gated behind `RUN_DATABASE_TESTS` like the rest of that file, not run locally
(no local Postgres available in this environment either) or live (blocked above). This phase has
real, unresolved verification gaps that Phases 5–10 didn't have — flagging that difference explicitly
rather than presenting it as equally verified.

## PHASE 12 — PROFILE (code complete, PR/live-verify blocked on tooling — see Phase 11)

Branch `claude/phase12-profile`, pushed. Cross-checked against `docs/pages/PROFILE.md`.

### High: 6 of the page's 7 tabs had no content at all
`app/users/[handle]/page.tsx` rendered `TabsTrigger`s for takes/activity/predictions/badges/
communities/following/followers, but only `takes` had a matching `TabsContent` — clicking any other
tab showed nothing. The tab set itself was also wrong against the doc: it specifies
Takes/Predictions/Debates/Communities/About, with badges living in the reputation summary and
follower/following as sidebar counts, not tabs — so this wasn't a case of "5 tabs missing content,"
the tab list itself didn't match the product spec. Rebuilt with the documented 5 tabs, each with a
real query and real content, and made them URL-backed (`?tab=`) per the doc's explicit "URL-backed
scrolling tabs" requirement — refresh and back/forward preserve the active tab, same pattern as
Phase 11's search type filter.

### High: no Follow button existed anywhere, despite a fully working backend
Confirmed via Phase 5's own finding, still true: `POST /api/v1/follows` is real and correct (create/
delete, notification on follow, idempotent), but nothing in the app ever called it — `ProfileCard`'s
follow prop went unused everywhere, and the profile page itself had no follow control at all. Built
a real `FollowButton` (optimistic, rolls back on failure) and wired it into the header.

### High: Block and Mute had complete schema models and zero API surface
`Block` and `Mute` are both fully modeled in `prisma/schema.prisma` with unique constraints ready for
upsert — confirmed via a repo-wide search that neither is referenced anywhere in
`app/api/v1/[...segments]/route.ts` or any other file. The doc requires both ("block confirms and
immediately hides interaction," block/mute listed under Permissions and data/API). Added both as
POST resources following the existing `follows` toggle pattern. Blocking also ends any mutual follow
in both directions as a transaction — otherwise a block wouldn't actually "immediately hide
interaction" if a stale mutual-follow relationship survived it. A block or "blocked by" relationship
now renders a privacy-safe surface instead of the full profile (doc: "Restricted/deleted/block
relationship uses privacy-safe surface") — the blocked-by-them case shows a generic "not available"
message rather than confirming to the blocked visitor that they were specifically blocked.

### High: the profile query had no status check at all
`db.user.findUnique` had no `where: { status }` filter, so a `SUSPENDED`/`PENDING_DELETION`/`DELETED`
account's full profile (bio, takes, everything) still rendered normally to any visitor. Matches the
doc's own account-deletion copy in `components/profile/account-danger-zone.tsx` ("restricts your
profile") — that restriction was promised at the point of deletion but never actually implemented on
the page itself. Fixed: non-owners see a privacy-safe "not available" state for any non-`ACTIVE`
status; the owner can still see their own profile regardless (so they can navigate to Settings).

### High: "More" menu (Report/Block/Mute) built on a component that already existed, fully built, completely unused
`components/ui/dropdown.tsx` is a real, working Radix dropdown wrapper — confirmed via search it was
never imported anywhere in the app before this change. Wired it into a new `ProfileActionsMenu`
(Report via the existing `POST /api/v1/reports` USER target, Mute, Block-with-confirmation). The
Block-confirmation flow nests a `ConfirmationDialog` trigger inside a `DropdownMenu.Item`, a
known-tricky Radix composition (the menu closing can unmount the dialog trigger before it opens) —
verified with a real `userEvent` interaction test, not just read from code, since this exact pattern
is easy to get wrong silently.

### Medium: prediction accuracy was read from counters that are never updated
`Profile.predictionCorrect`/`predictionTotal` are set once at onboarding (always 0) and never
incremented anywhere — confirmed via repo-wide search, no `PredictionResult` row is ever created in
this codebase at all. **This means predictions are never actually resolved against real game
outcomes anywhere in the app** — a real gap, not scoped to fix here (it's a resolution-pipeline gap,
not a profile-page bug), but worth flagging loudly since `app/(app)/arena/page.tsx` has the exact
same dead-counter bug for Phase 13 to pick up. Fixed narrowly for this page: accuracy is now computed
live from real `Prediction`/`PredictionResult` rows (currently always "no resolved predictions yet"
for every user, honestly, since resolution doesn't exist yet — not a fake number). Also implemented
the doc's privacy rule for predictions: an unlocked pick's `selection` is concealed from everyone but
the owner ("not active private choice before lock").

### Found and wired: `privacySettings.profileDiscoverable` was stored and never read
Confirmed via search: the API validates and persists this field but nothing ever consumed it.
Wired it into `generateMetadata`'s `robots` directive (noindex when `false`), alongside noindex for
deleted/suspended/restricted profiles per the doc's SEO section. This is an inference, not something
the doc names explicitly by field — flagging that rather than presenting it as directly specified.

### Also fixed
Avatar/favorite teams (resolved from the stored team-ID array) now actually render in the header —
previously nothing read `Profile.avatarUrl` or `favoriteTeams` on this page at all. Badges moved out
of the tab list into the reputation summary per the doc's section order, with a real "How reputation
works" breakdown sourced from the actual `FAN_SCORE_POINTS` table instead of an invented explanation.
The profile query now uses an explicit `select` rather than a broad `include`, so private fields
(email, role, moderation flags) can't leak onto this page even by future accident. Added real
cursor-based "Load more" to all four list tabs instead of an unbounded query.

### Flagged, not built — needs a product decision, not a code fix
A full browsable followers/following list. The doc's layout section only requires the *counts* in the
sidebar (done, real), not a list UI — but the "Assumptions and decisions" section states follower
lists are public, which only means something if a list view exists somewhere. Not built here to stay
scoped to what the page's own layout section actually calls for; flagging the ambiguity rather than
guessing at a full new feature.

**Verification:** typecheck/lint/build clean. `npm run test` clean (45/45, no regressions). Added
`tests/unit/profile-actions.test.tsx` (5 new tests) covering the follow optimistic-update/rollback,
the Block confirmation-then-API-call flow via real `userEvent` clicks (not just a render check --
this is exactly the kind of nested-Radix interaction that can silently misbehave), and Unblock. Added
2 new integration tests to `tests/integration/database-flows.test.ts` (blocks/mutes round-trip,
block-ends-mutual-follow) — gated behind `RUN_DATABASE_TESTS` like the rest of that file. Same
verification gap as Phase 11: no local Postgres available to actually run the gated integration
tests, and no live-Preview check possible this session (Vercel MCP/GitHub tooling still down) —
stated plainly rather than presented as equally verified to Phases 5–10.

## Next batches (not yet crawled)
Phases 1–10 are complete and shipped as draft PRs (see their sections above). Phases 11 (Search) and
12 (Profile) are code-complete and pushed but **not yet opened as PRs or live-verified** — blocked on
Vercel MCP/GitHub tooling access this session (Vercel MCP connector disconnected mid-session, no `gh`
CLI or accessible GitHub token in this environment); both need a retry or manual PR creation before
merge review. GitHub's push output gives direct links:
`https://github.com/CaffeinatedCheetah/SIDELINE/pull/new/claude/phase11-search` and
`https://github.com/CaffeinatedCheetah/SIDELINE/pull/new/claude/phase12-profile`. Phase 4 is
audit-only, awaiting Babs's decision per the three options laid out there (now: following the
roadmap, blocked on `BALLDONTLIE_KEY`). Full Phase 23 accessibility audit (axe scans) and full Phase
24 responsive matrix are still pending — not yet run, not blocked on anything. Phase 13 (My Arena) is
next.
