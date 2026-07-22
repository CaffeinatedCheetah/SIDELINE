# FanTakes implementation roadmap

## Existing baseline

Documentation-only repository. No executable application or infrastructure.

## Phase 1 — Foundation

- Create Next.js strict-TypeScript application and quality configuration.
- Implement semantic tokens, fonts, shell, accessibility primitives, and shared
  components.
- Configure Prisma/PostgreSQL, deterministic seed, Auth.js, environment schema,
  request IDs, logging, CI, preview deployment, and test tools.
- Exit: clean setup works from README; lint, typecheck, unit tests, build, and
  migration validation pass.

## Phase 2 — Public discovery

- Home, Games, Game Room read state, Debate Center/detail read state,
  Communities/detail read state, profiles, Hall of Flame, and search.
- Provider-neutral game adapter with deterministic development fixture data.
- SEO metadata, sitemap, structured data, caching, error/empty/offline states.
- Exit: public browse flow works at mobile/desktop and meets accessibility smoke.

## Phase 3 — Identity and participation

- Auth, onboarding, sessions, profile/settings, follows, My Arena.
- Takes, replies, reactions, game follows, predictions, debate positions, and
  public community membership.
- Notifications and analytics-safe event tracking.
- Exit: critical participation E2E flows pass with authorization matrix.

## Phase 4 — Trust and safety

- Report, mute, block, content tombstones, moderator queue, audit events, appeals
  state, suspension handling, rate limiting, and account deletion.
- Security headers, CSRF/origin enforcement, privacy/retention jobs, operational
  dashboards, backup and restore rehearsal.
- Exit: abuse and permission tests pass; moderation and deletion are auditable.

## Phase 5 — Release hardening

- Performance budgets, load test game polling/write paths, visual regression,
  full keyboard/screen-reader review, SEO validation, migration dry run,
  production monitoring, runbooks, incident contacts, and rollback drill.
- Exit: release checklist signed by product, engineering, design/accessibility,
  security/privacy, and operations owners.

## Deferred roadmap

- Named live-data vendor integration beyond the adapter contract.
- WebSockets unless polling proves insufficient.
- Native apps, private communities, direct messaging, media uploads, payments,
  wagering, prizes, creator monetization, public developer API, and AI judgment.

## Deployment contract

- Vercel preview for each pull request and protected production deploy from main.
- Managed PostgreSQL with pooled runtime connections and direct migration URL.
- Environment variables validated at build/start; `.env.example` contains names,
  never secrets.
- Forward migrations execute once before application promotion.
- Rollback prefers application rollback compatible with forward schema; destructive
  schema cleanup requires a later deploy after compatibility window.
- Monitor availability, error rate, latency, job lag, score freshness, auth errors,
  and moderation queue age.

## Assumptions and decisions

- Dates are assigned only after team capacity is known.
- A phase can ship incrementally behind server-side flags, but flags do not bypass
  authorization or produce undocumented public contracts.
- Documentation updates accompany behavior changes.
