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
public discovery and navigation. Database-backed authentication and mutation
tests require an isolated PostgreSQL connection and have not yet been executed
on this workstation.

Latest local verification:

- Prisma Client generation: passed with Prisma 6.19.3.
- Lint: passed with zero warnings.
- Strict TypeScript: passed.
- Vitest/React Testing Library: 25 tests passed across 9 files.
- Playwright: 4 tests passed across desktop Chromium and mobile Chromium.
- Production build: passed with development authentication disabled, as
  production policy requires.
- Migration and seed execution: blocked because no PostgreSQL server is
  available at the configured local address. Schema validation, client
  generation, and migration SQL generation passed.

## Environment variables

See `.env.example` and the root README. Required production values are
`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, and
`NEXT_PUBLIC_APP_URL`, plus at least one configured Google or SMTP sign-in
provider. `ENABLE_DEV_AUTH` must be false in production.

## Deployment

Install with `npm ci`, generate Prisma Client, run all static/test/build gates,
then execute `npm run db:deploy` once in a protected release job. Deploy the
Next.js output to Vercel with a pooled PostgreSQL runtime connection. Never run
the development seed or development authentication in production.

## Security notes

All write routes derive identity from Auth.js. Content and voting inputs are
schema-validated. Debate and poll votes enforce uniqueness in PostgreSQL.
Prediction locks are checked server-side. Community moderation and global
moderation use stored roles. Public projections omit Auth.js tokens and private
settings. Account deletion enters the specified 14-day pending state.

The in-memory rate limiter is an abstraction suitable for one development
process, not a shared production quota store. Production should attach a
distributed adapter without changing handler policy.

The production dependency audit currently reports advisories inherited from
the latest stable Next.js/Auth.js dependency trees, including Nodemailer's raw
message option and Next.js-bundled PostCSS/sharp versions. FanTakes never accepts
or forwards caller-controlled raw email options. The compatible Prisma security
patch was applied. Playwright remains pinned to the newest release that executes
on this macOS 11 workstation; newer advisory-fixed builds require macOS 12, so
this test-only advisory must be resolved in CI on a supported operating system.
Remaining production advisories have no non-breaking upstream resolution
available at this snapshot and must be rechecked before deployment.

## Known limitations and deferred features

- No live sports-data provider is connected. Development uses labeled seed
  snapshots; polling is ready for a provider-backed game endpoint.
- PostgreSQL and browser binaries are not installed on the current workstation,
  so live migration/seed and browser execution require external infrastructure.
- Game stats, play-by-play, and highlights display truthful empty states until a
  provider is configured.
- Data export is an explicitly disabled placeholder. It does not claim success.
- Media upload, private communities, self-service community creation, direct
  messaging, WebSockets, wagering, prizes, and automatic punishments are
  deferred by the product specification.
- Google OAuth, email delivery, and Vercel deployment require external service
  credentials.

## Recommended next steps

1. Run the migration and seed against an isolated PostgreSQL database.
2. Execute database-backed integration and Playwright flows in CI.
3. Select a sports-data provider and implement the documented adapter contract.
4. Replace the development rate limiter with a distributed production adapter.
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
