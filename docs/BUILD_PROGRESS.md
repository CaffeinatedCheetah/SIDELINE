# FanTakes Version 1 build progress

Last updated: 2026-07-23

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
- Supabase PostgreSQL is configured locally through ignored environment state.
  Google, email, sports-data, and Vercel production credentials remain external.

## Feature ledger

| Area                          | Route                                        | UI       | Backend  | Tests          | Status      | Notes                                                                             |
| ----------------------------- | -------------------------------------------- | -------- | -------- | -------------- | ----------- | --------------------------------------------------------------------------------- |
| Tooling and application shell | all                                          | Complete | Complete | Basic checks   | Complete    | Responsive navigation and authenticated shell                                     |
| Design system and primitives  | shared                                       | Complete | N/A      | Unit coverage  | Complete    | Semantic tokens and accessible shared controls                                    |
| Database, migration, seed     | N/A                                          | N/A      | Complete | DB integration | Complete    | Supabase migration, repeated seed, constraints, relations, and drift verified     |
| Authentication and onboarding | `/auth/*`, `/onboarding`                     | Complete | Complete | DB + E2E       | Complete    | Development login, session persistence, logout, and persistence verified          |
| Public homepage               | `/`                                          | Complete | Complete | E2E passed     | Complete    | Server-rendered database discovery                                                |
| Games directory               | `/games`                                     | Complete | Complete | Component      | Complete    | League and status filters                                                         |
| Game Room                     | `/games/[gameId]`                            | Partial  | Complete | DB integration | In progress | Backend posting, reactions, polls, and prediction locks verified; UI remains      |
| My Arena                      | `/arena`                                     | Complete | Complete | DB pending     | In progress | Authenticated personalized queries                                                |
| Debate Center/detail          | `/debates`, `/debates/[debateId]`            | Complete | Complete | DB integration | Complete    | Creation, unique voting, and server percentages verified                          |
| Community directory/detail    | `/communities`, `/communities/[slug]`        | Complete | Complete | DB integration | Complete    | Join, leave, notification preference, and duplicate prevention verified           |
| Public/editable profile       | `/users/[handle]`, `/settings`               | Partial  | Partial  | DB pending     | In progress | Basic profile works; interests/privacy/session controls incomplete                |
| Hall of Flame                 | `/hall-of-flame`                             | Complete | Complete | Domain unit    | In progress | Deterministic multi-signal ranking                                                |
| Notifications                 | `/notifications`                             | Partial  | Partial  | DB pending     | In progress | Read APIs exist; generation and open-to-read flow incomplete                      |
| Search                        | `/search`                                    | Complete | Complete | Unit passed    | Complete    | Debounced multi-entity search                                                     |
| Moderation and safety         | `/moderation`, API                           | Partial  | Partial  | DB pending     | In progress | Audit records exist; action effects and moderator UI incomplete                   |
| Legal/help pages              | `/help`, `/guidelines`, `/terms`, `/privacy` | Complete | N/A      | Pending        | In progress | Public static content                                                             |
| API v1                        | `/api/v1/*`                                  | N/A      | Partial  | Domain unit    | In progress | Core routes exist; idempotency and documented resource coverage incomplete        |
| Accessibility and SEO         | all                                          | Complete | Complete | Component      | Complete    | Landmarks, focus, metadata, sitemap, robots                                       |
| Deployment and operations     | N/A                                          | N/A      | Complete | Build + DB     | Complete    | Pooled runtime, direct migrations, preview seed guard, and Vercel vars documented |

## Explicitly deferred

- Payments, wagering, prizes, native apps, direct messages, media uploads,
  livestreaming, private communities, self-service community creation, AI debate
  judging, automatic moderation punishment, public developer API, webhooks, and
  WebSockets.

## Remaining gaps

- Google OAuth, email delivery, and the sports provider require external
  credentials and provider setup.
- Several documented controls remain UI-incomplete even though their
  server-authoritative mutation paths now have PostgreSQL evidence; see
  `PRE_MERGE_REVIEW.md`.
- The in-memory rate limiter must be replaced before an unrestricted public
  launch on a multi-instance serverless deployment.
