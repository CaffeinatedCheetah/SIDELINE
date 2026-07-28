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
- [x] Unit tests — 59/59 passed
- [ ] Integration tests — 17 skipped locally (`RUN_DATABASE_TESTS` unset, no local Postgres)
- [ ] Production build — **FAILS locally**: `/guidelines` (and likely every page) fails static collection because `DATABASE_URL`/`DIRECT_URL`/`AUTH_SECRET` aren't set in `.env.local` (only `VERCEL_OIDC_TOKEN` present). Needs real env values (local Postgres, or `vercel env pull` — blocked this session by the permission classifier, needs explicit user approval) to verify.
- [ ] Existing Playwright tests — not yet run (blocked behind same env gap; `PLAYWRIGHT_BASE_URL` also unset locally)
- [x] Confirmed which environment: local checkout, no live env attached
- [ ] Confirm Preview is not writing to Production Supabase — **UNVERIFIED this session** (env-value pull blocked by classifier); prior audit (2 days old) found Preview pointed at an empty auto-provisioned Supabase project while Production was corrected — re-confirm before Phase 2 work touches persistence
- [x] Written issue checklist (this file)
- [x] Verified against actual current repo state, not audit-doc assumptions (see baseline report)

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
- [ ] Script-based role assignment already exists in an **abandoned, unmerged, locked worktree** (`prisma/scripts/promote-user-role.ts` @ commit `788097b`, branch `worktree-sideline-phase1-item1`) — recover and properly land this rather than rewriting from scratch

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
- [ ] `.claude/worktrees/agent-a2b85be004ac5966a` and `agent-a898996f5eadd5c7d` — stray, untracked, all content already superseded in `origin/main` history; safe to remove after confirming with user (they pollute `eslint`'s walk since `.claude/worktrees/**` isn't in `globalIgnores`)
- [ ] `.claude/worktrees/sideline-phase1-item1` (locked) — contains real unmerged work (F1 tab fix, moderator-role script, loading-skeleton hang fixes) that should be recovered onto a real branch, not discarded
- [ ] `vercel.json` rewrites `/onboarding` → legacy static `onboarding.html`, shadowing the real `app/(app)/onboarding/page.tsx` Next.js route — likely unintentional, needs a product decision
- [ ] 30 legacy `api/*.js` serverless functions + 5 legacy static HTML pages remain deployed; open decision from the prior audit, still unresolved
