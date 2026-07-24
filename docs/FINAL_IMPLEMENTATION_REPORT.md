# FanTakes Version 1 implementation report

## Architecture

FanTakes is a Next.js App Router application using React, strict TypeScript,
Tailwind CSS, PostgreSQL through Prisma, Auth.js, Zod-validated REST handlers,
Vitest/React Testing Library, and Playwright. Server components read through the
Prisma service boundary. Mutations use authenticated `/api/v1` handlers; caller
user IDs are never accepted where session identity is authoritative.

The product uses one premium black-and-red token system in `app/globals.css`.
Reusable UI, navigation, sports, debate, community, profile, and participation
components live under `components/`. Domain policy is isolated under `lib/`.

## Routes implemented

- `/`: public discovery homepage.
- `/auth/sign-in`, `/auth/sign-up`, `/auth/error`, `/onboarding`.
- `/arena`: personalized authenticated dashboard.
- `/games`, `/games/[gameId]`: directory and Game Room.
- `/debates`, `/debates/new`, `/debates/[debateId]`.
- `/communities`, `/communities/[slug]`.
- `/users/[handle]`, `/hall-of-flame`.
- `/notifications`, `/search`, `/settings`.
- `/moderation`: moderator/admin report queue.
- `/help`, `/guidelines`, `/terms`, `/privacy`.
- `/robots.txt`, `/sitemap.xml`.

## Components implemented

The shared library includes Button, form controls, Avatar, Badge, Card, Tabs,
Modal, Drawer, Dropdown, Toast, Skeleton, EmptyState, ErrorState, and
ConfirmationDialog. Domain components include Navbar, application sidebar,
footer, GameCard, live Game Room status, TakeCard, DebateCard, PollCard,
CommunityCard, ProfileCard, search, take composition, debate voting, community
membership, prediction submission, and account deletion confirmation.

## Database models

The initial Prisma migration includes Auth.js identity/session tables, users and
profiles, sports/leagues/teams/games, participants and follows, public
communities and roles, takes/comments/reactions, debates/options/votes,
polls/options/votes, predictions/results, social follows/blocks/mutes,
notifications, badges, Fan Score ledger events, Hall of Flame entries, saved
items, reports, and append-only moderation actions.

The idempotent development seed creates sports, leagues, teams, three explicitly demo-only
users, live/upcoming games, a community, takes, an open debate, badges, a score
event, and a Hall of Flame entry.

## Authentication behavior

Auth.js conditionally enables Google OAuth and SMTP magic links from environment
configuration. Development may enable a credentials provider restricted to
seeded `@fantakes.local` accounts. That provider cannot load in production.
Protected routes preserve their callback destination. Onboarding persists name,
handle, favorite sports, favorite teams, and progress before redirecting to My
Arena.

## API endpoints

`/api/v1` supports games, users/profiles, communities and membership, takes,
comments, reactions, debates and votes, polls and poll votes, predictions,
notifications, multi-entity search, Fan Score, Hall of Flame, follows, saved
items, reports, moderation actions, profile completion, account deletion, and
an admin-only Hall of Flame job trigger. Responses use one error envelope,
Zod validation, session authorization, bounded pagination, and a replaceable
rate-limit abstraction.

## Fan Score and Hall of Flame

Fan Score is an append-only, idempotent, server-authored event ledger with a
visible reason per event. Clients cannot supply score values. Hall of Flame
ranking weights quality, conversation, and trusted participation; removed or
heavily reported candidates are ineligible. Ties use stable entity IDs. The job
service can run manually or from a protected scheduler adapter.

## Tests

Unit and component coverage verifies controls, forms, modals, navigation,
content cards, participation actions, API envelopes, rate limiting, Fan Score,
Hall ranking, permissions, voting rules, and prediction locks. Playwright covers
public discovery and navigation. The opt-in PostgreSQL integration suite covers
onboarding/profile persistence, communities, takes, debates, polls,
predictions, follows, notifications, Fan Score, Hall of Flame, moderation, and
account deletion against Supabase. An authenticated browser flow verifies
development login, session persistence, logout, and protected redirection.

Latest local verification:

- Prisma Client generation: passed with Prisma 6.19.3.
- Initial migration `202607220001_initial`: applied successfully.
- Prisma migration status: database schema is up to date.
- Schema drift: no difference detected.
- Seed: passed twice with stable counts and working relations.
- Lint: passed with zero warnings.
- Strict TypeScript: passed.
- Vitest/React Testing Library: 25 standard tests passed; 11 opt-in PostgreSQL
  tests also passed against Supabase.
- Playwright: 4 public tests passed across desktop and mobile Chromium; the
  opt-in authenticated database flow passed in desktop Chromium.
- Production build: passed with development authentication disabled, as
  production policy requires.

## Environment variables

See `.env.example` and the root README. Required production values are
`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, and
`NEXT_PUBLIC_APP_URL`, plus at least one configured Google or SMTP sign-in
provider. `ENABLE_DEV_AUTH` must be false in production.

## Deployment

`vercel.json` fixes the framework to Next.js and uses `npm ci` followed by
`npm run build`. Node.js 22 is declared in `package.json`, and `postinstall`
generates Prisma Client. Migrations and seeds are deliberately absent from the
normal build.

The feature branch reaches the connected Vercel integration, but Vercel blocks
deployment before installation because the GitHub/Vercel project contributor
relationship is not authorized. The latest commits are correctly associated
with `CaffeinatedCheetah`; Vercel Login Connections/project membership remains
the external blocker. No preview URL exists yet.

## Security notes

All write routes derive identity from Auth.js. Content and voting inputs are
schema-validated. Debate and poll votes enforce uniqueness in PostgreSQL.
Prediction locks are checked server-side. Community moderation and global
moderation use stored roles. Public projections omit Auth.js tokens and private
settings. Account deletion enters the specified 14-day pending state.

Rate limiting uses an atomic PostgreSQL bucket shared across serverless
instances. Policies are route-specific, keys support authenticated and
privacy-hashed anonymous callers, and rejected requests include `Retry-After`.
Database failure fails the mutation closed through the API error boundary.

Moderation actions are transactional: removal/restoration changes content
state, warnings notify the affected user, temporary mutes block mutations until
expiry, bans suspend the account, and every action remains in the append-only
audit log.

The complete dependency audit reports 15 advisories (4 moderate, 10 high, 1
critical); the production-only audit reports 9 high advisories. Runtime paths
are Auth.js → Nodemailer and Next.js → bundled PostCSS/sharp. FanTakes never
accepts caller-controlled Nodemailer raw message options, CSS source maps, or
image-processing input. Auth.js currently permits Nodemailer 7 or 8, so the
patched Nodemailer 9 line is not a compatible update. npm proposes an invalid
breaking Next downgrade for its bundled dependencies. The remaining
esbuild/Vitest and Playwright findings are development tooling; the local
Playwright pin is required by macOS 11. Do not run `npm audit fix --force`.

## Known limitations and deferred features

- No live sports-data provider is connected. Development uses labeled seed
  snapshots; polling is ready for a provider-backed game endpoint.
- Managed-database responses are slower than local PostgreSQL; integration and
  browser tests use explicit bounded timeouts without changing application
  request semantics.
- Game stats, play-by-play, and highlights display truthful empty states until a
  provider is configured.
- Data export is an explicitly disabled placeholder. It does not claim success.
- Media upload, private communities, self-service community creation, direct
  messaging, WebSockets, wagering, prizes, and automatic punishments are
  deferred by the product specification.
- Google OAuth, email delivery, and Vercel deployment require external service
  credentials.
- Hosted preview route, callback, cookie, and responsive QA remain blocked by
  Vercel project access.

## Recommended next steps

1. Link the GitHub identity to the owning Vercel account/project and redeploy.
2. Add the opt-in PostgreSQL and authenticated Playwright flows to protected CI.
3. Complete the remaining UI wiring identified in `PRE_MERGE_REVIEW.md`.
4. Select a sports-data provider and implement the documented adapter contract.
5. Complete legal review of Terms, Privacy, retention, and data export behavior.

## Local commands

```bash
cp .env.example .env.local
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Verification commands are `npm run lint`, `npm run typecheck`, `npm test`,
`npm run test:e2e`, and `npm run build`.
