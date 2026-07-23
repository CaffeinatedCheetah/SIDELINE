# FanTakes Version 1 build progress

Last updated: 2026-07-22

## Environment and decisions

- Branch: `claude/fantakes-v1-implementation`.
- Baseline: `e3cf6cb23868f1198627feeffd8fc321b4b5b1fe`.
- Runtime selected: Node.js 22 LTS because the current machine runs macOS 11;
  the current Node.js 24 binary requires a newer system C++ runtime.
- Application target: Next.js 16 Active LTS, React 19.2, strict TypeScript.
- Repository initially contained documentation only; every runtime feature below
  is new functionality.
- `docs/FAN_SCORE.md` and `docs/HALL_OF_FLAME.md` referenced by the build request
  do not exist. Fan Score and ranking will use the transparent event-ledger and
  eligibility rules in `DATABASE_SCHEMA.md`, `PRODUCT_VISION.md`, and
  `pages/HALL_OF_FLAME.md`. No hidden formula will be invented.
- External Google, email, PostgreSQL, sports-data, and Vercel services are not
  configured locally. Development adapters and deterministic seed data will be
  used without claiming production integration.

## Feature ledger

| Area                          | Route                                        | UI          | Backend     | Tests         | Status      | Notes                                                                           |
| ----------------------------- | -------------------------------------------- | ----------- | ----------- | ------------- | ----------- | ------------------------------------------------------------------------------- |
| Tooling and application shell | all                                          | In progress | Complete    | Basic checks  | In progress | Next.js scaffold, scripts, environment and build pass; navigation shell follows |
| Design system and primitives  | shared                                       | Complete    | N/A         | Unit coverage | Complete    | Semantic tokens and accessible shared controls                                  |
| Database, migration, seed     | N/A                                          | N/A         | Not started | Not started   | Not started | PostgreSQL/Prisma                                                               |
| Authentication and onboarding | `/auth/*`, `/onboarding`                     | Not started | Not started | Not started   | Not started | Dev-safe credentials adapter plus Google/email config                           |
| Public homepage               | `/`                                          | Not started | Not started | Not started   | Not started | Server-rendered discovery                                                       |
| Games directory               | `/games`                                     | Not started | Not started | Not started   | Not started | Date/league/status filters                                                      |
| Game Room                     | `/games/[gameId]`                            | Not started | Not started | Not started   | Not started | Polling, takes, predictions, polls                                              |
| My Arena                      | `/arena`                                     | Not started | Not started | Not started   | Not started | Authenticated personalized queries                                              |
| Debate Center/detail          | `/debates`, `/debates/[debateId]`            | Not started | Not started | Not started   | Not started | Positions, votes, replies                                                       |
| Community directory/detail    | `/communities`, `/communities/[slug]`        | Not started | Not started | Not started   | Not started | Public communities only                                                         |
| Public/editable profile       | `/users/[handle]`, `/settings`               | Not started | Not started | Not started   | Not started | Fan identity and privacy                                                        |
| Hall of Flame                 | `/hall-of-flame`                             | Not started | Not started | Not started   | Not started | Transparent scheduled ranking                                                   |
| Notifications                 | `/notifications`                             | Not started | Not started | Not started   | Not started | Read state, filters, preferences                                                |
| Search                        | `/search`                                    | Not started | Not started | Not started   | Not started | Debounced accessible search                                                     |
| Moderation and safety         | internal/API                                 | Not started | Not started | Not started   | Not started | Reports and audit actions                                                       |
| Legal/help pages              | `/help`, `/guidelines`, `/terms`, `/privacy` | Not started | N/A         | Not started   | Not started | Public static content                                                           |
| API v1                        | `/api/v1/*`                                  | N/A         | Not started | Not started   | Not started | Zod, auth, errors, cursors, rate abstraction                                    |
| Accessibility and SEO         | all                                          | Not started | Not started | Not started   | Not started | WCAG 2.2 AA, metadata, sitemap, robots                                          |
| Deployment and operations     | N/A                                          | N/A         | Not started | Not started   | Not started | Vercel-compatible config and runbook                                            |

## Explicitly deferred

- Payments, wagering, prizes, native apps, direct messages, media uploads,
  livestreaming, private communities, self-service community creation, AI debate
  judging, automatic moderation punishment, public developer API, webhooks, and
  WebSockets.

## Blockers

- No system Node.js/npm installation was available; an official Node.js 22 LTS
  binary is being used for this build session.
- PostgreSQL is not installed locally. Migration and seed verification require a
  reachable development/test `DATABASE_URL`; container tooling is also absent.
