# Sprint 1 Remediation Checklist — Real Sports Data + Confirmed-Issue Fixes

Baseline established on `remediation/sprint-1-baseline` (branched from `origin/main` @ `afbd388`) on 2026-07-27.
Source: user-provided 17-phase brief + fresh verification against current repo state (do not trust
`.claude/tasks/phase1-audit.md`'s tail without re-checking — it is a historical log, several items it
lists as "unmerged" are now merged).

## Phase 1 — Baseline
- [x] Dedicated remediation branch created (`remediation/sprint-1-baseline`)
- [x] Dependency install, `prisma generate` — clean
- [x] Lint — clean on real app tree (failures were 100% from 3 stray untracked worktree dirs under `.claude/worktrees/`, already ignored via `eslint.config.mjs` for `api/**/*.js` + `script.js`)
- [x] Typecheck — clean
- [x] Unit tests — **59/59 passed** (real run, `npm test`)
- [x] Integration tests — **real result: 1 suite FAILS (not skipped)**. With `RUN_DATABASE_TESTS=true` set, `tests/integration/database-flows.test.ts` (17 tests) fails with `PrismaClientInitializationError: Can't reach database server at localhost:5432` — no local Postgres exists in this environment. This is a pre-existing, documented gap (`.github/workflows/ci.yml` itself leaves `RUN_DATABASE_E2E`/DB-gated tests unset for the same reason — "no seeded isolated Postgres test database exists in this CI environment yet"), not something this session introduced. Needs either a local/CI Postgres or explicit acceptance of the gap.
- [x] Production build — **PASSES**. Local build fails without DB creds (Sensitive Vercel env vars — see below), but `.github/workflows/ci.yml` already establishes the correct pattern: build with the same public CI placeholder values (`DATABASE_URL`/`DIRECT_URL`/`AUTH_SECRET`/`NEXT_PUBLIC_APP_URL`, checked into the repo, not secrets — pages use force-dynamic + try/catch so no live DB connection is needed at build time). Ran `npm run build` with those exact values: **compiles clean, all 30 routes generated**.
- [x] Existing Playwright tests — **ran against local dev server with CI-matching placeholder env** (see live run output/report for exact pass/fail counts — this was still finishing as this checklist was written; treat the accompanying baseline report's Playwright section as authoritative for final counts).
- [x] Confirmed which environment: local checkout, verified against real Vercel env var inventory (`vercel env ls`) and a real CI-pipeline build (not just typecheck)
- [x] Confirm Preview is not writing to a different Supabase project than Production — **same project, high confidence**. `vercel env ls` groups `DATABASE_URL` and `DIRECT_URL` under a single row spanning "Production, Preview" (Vercel only does this when one stored value is shared across both — vars with different per-environment values, e.g. `ENABLE_DEV_AUTH`, `AUTH_URL`, show as separate rows). `vercel env pull` itself returns these two vars empty by design (Vercel "Sensitive" var type withholds values from `env pull`/`vercel build` even with full project auth — confirmed by testing, not assumed) so the raw value could not be diffed directly, but `NEXT_PUBLIC_SUPABASE_URL` (pullable, not sensitive) is identical between Production and Preview pulls (`wleunpfiokcdbuydkhho`), consistent with a single shared DB config. Residual risk: cannot rule out the single shared DATABASE_URL being Production's DB reused for Preview (opposite problem from 2 days ago) — recommend the user confirm directly in the Vercel dashboard which project that shared credential targets.
- [x] Written issue checklist (this file)
- [x] Verified against actual current repo state, not audit-doc assumptions (see baseline report)

**Vercel "Sensitive" env vars note:** `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, `BALLDONTLIE_KEY`, `NEWS_API_KEY`, `YOUTUBE_API_KEY`, `REDIS_URL`, `KV_*` all pulled as empty strings via `vercel env pull` in both Production and Preview, despite `vercel env ls` showing them as present/"Encrypted". This is Vercel's Sensitive-variable protection working as intended, not a bug — but it means **no automated tooling in this environment can ever get real values for these**; local integration/e2e-against-real-DB testing needs either a real local Postgres or the user supplying values through a channel other than the CLI.

## Phase 2 — Canonical sports-data layer
- [ ] Reconcile the two existing, incompatible provider systems (BallDontLie `lib/sports/{provider,sync,balldontlie}.ts` — dead, 401s — vs. live ESPN `lib/sports/{espn,espn-materialize}.ts`) into one canonical layer
- [ ] Canonical game states, central status mapping
- [ ] Canonical internal game representation per spec
- [ ] Caching, stale-data detection, provider-error handling

## Phase 3 — Timezones app-wide
- [ ] Shared date/time utility
- [ ] Audit Games, Homepage, Game Rooms, Takes, Comments, Debates, Communities, Profiles, Notifications, Hall of Flame, Moderation, Settings, activity feeds
- [ ] DST + near-midnight deterministic tests

## Phase 4 — Homepage real data
- [ ] Remove contradictory "Live data is unavailable" state
- [ ] Same source as Games page, priority-ordered sections, truthful empty state

## Phase 5 — League coverage matrix
- [ ] Document all leagues (NBA/NFL/MLB/NHL/WNBA/NCAA/UFC/Soccer confirmed present in `lib/sports/espn.ts`)
- [ ] F1 decision — note: unmerged work in abandoned worktree already removed F1 as a clickable tab with a documented rationale; evaluate reusing it (see baseline report)
- [ ] Sport-aware presentation models

## Phase 6 — Game Room materialization E2E
- [ ] Concurrency/idempotency tests for `materializeEspnGame`

## Phase 7 — Hall of Flame operational fix
- [ ] `prisma/scripts/run-hall-of-flame.ts` exists but has no scheduled execution (Hobby plan: daily crons only, none currently assigned to it)
- [ ] Idempotency, structured logs, overlap prevention, 4-state UI

## Phase 8 — Fan Score
- [ ] Confirmed gap from prior audit: `PredictionResult` is never created anywhere in the codebase — predictions do not resolve
- [ ] Document spec, ledger-based events, resolve predictions

## Phase 9 — Notifications
- [ ] Inventory categories, implement missing ones, dedupe/pref enforcement

## Phase 10 — Badges
- [ ] Inventory badge types, v1 award system or hide UI

## Phase 11 — Settings efficacy
- [ ] Appearance/Motion/Data settings currently persist with no effect (confirmed by prior audit)

## Phase 12 — Moderation role management
- [x] Script-based role assignment recovered from the abandoned locked worktree onto a real, pushed branch: `prisma/scripts/promote-user-role.ts` @ commit `788097b`, now on `recovered/f1-and-moderator-role-fixes` (pushed to origin, not merged). Still needs: review, then land as its own scoped PR before Phase 12 work builds on it.

## Phase 13 — Dependency/security upgrades
- [ ] `npm audit`: 24 vulnerabilities (1 critical, 19 high, 4 moderate) as of 2026-07-27 — needs triage table, batched upgrades

## Phase 14 — Cold start / content
- [ ] Audit Trending Takes, Debates, Communities, Hall of Flame, empty Game Rooms; honest seeding plan

## Phase 15 — E2E journeys
- [ ] Guest + new-Google-user Playwright journeys per spec

## Phase 16 — Observability / alerting
- [ ] Provider-failure and materialization-failure alerting

## Phase 17 — Acceptance / reporting matrix
- [ ] Final PASS/FAIL/PARTIAL/BLOCKED/NOT IMPLEMENTED matrix + READY/NOT READY recommendation

## Housekeeping found during baseline (not a numbered phase, but blocking hygiene)
- [x] `.claude/worktrees/sideline-phase1-item1`'s unique commits (F1 tab fix, moderator-role script, loading-skeleton hang fixes) recovered onto pushed branch `recovered/f1-and-moderator-role-fixes` — not merged, awaiting review.
- [ ] **Worktree directory removal is BLOCKED**: `git worktree remove` (with or without `--force`) for all three stray worktrees (`agent-a2b85be004ac5966a`, `agent-a898996f5eadd5c7d`, `sideline-phase1-item1`) was denied by this session's permission classifier as a destructive operation, even after the recovery above. Needs the user to either run the removal themselves or grant permission live. Until removed, they continue polluting `eslint`'s walk (`.claude/worktrees/**` isn't in `globalIgnores`) — this is why `npm run lint` (no path scoping) still reports thousands of problems even though the real app tree is clean.
- [ ] `vercel.json` rewrites `/onboarding` → legacy static `onboarding.html`, shadowing the real `app/(app)/onboarding/page.tsx` Next.js route — likely unintentional, needs a product decision
- [ ] 30 legacy `api/*.js` serverless functions + 5 legacy static HTML pages remain deployed; open decision from the prior audit, still unresolved
- [ ] Repo's `CLAUDE.md` documents only the legacy static-site/Clerk system (`index.html`, `api/*.js` handlers) as if it were the whole project — no mention of the real Next.js app (`app/`, `prisma/`) at all. Worth updating so future sessions (human or agent) don't anchor on the wrong system by default.
