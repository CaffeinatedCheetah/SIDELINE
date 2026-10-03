# FanTakes

FanTakes is a live sports participation network: scores bring fans in,
conversations keep them, and identity brings them back.

## Requirements

- Node.js 22 LTS
- npm 10+
- PostgreSQL 15+

## Local setup

```bash
cp .env.example .env.local
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. Development authentication is available only when
`ENABLE_DEV_AUTH=true`; production must configure Google and/or SMTP and disable
development authentication.

The seed creates `demo@fantakes.local`, `maya@fantakes.local`, and
`devon@fantakes.local`. With development authentication enabled, enter one of
those addresses on the sign-in screen. This provider is deliberately unavailable
when `NODE_ENV=production`.

## Environment

- `DATABASE_URL`: PostgreSQL runtime connection. It can point to the Docker
  PostgreSQL service, a local PostgreSQL server, or another managed PostgreSQL host.
- `DIRECT_URL`: direct PostgreSQL migration connection. It may match
  `DATABASE_URL` for self-hosted PostgreSQL; managed poolers should use their
  provider's direct/non-pooled migration URL.
- `AUTH_SECRET`: random secret of at least 16 characters.
- `AUTH_URL`: deployed Auth.js callback origin.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: optional Google OAuth pair.
- `EMAIL_SERVER` / `EMAIL_FROM`: optional SMTP transport for magic links.
- `ENABLE_DEV_AUTH`: local seeded-account provider; must be `false` in production.
- `NEXT_PUBLIC_APP_URL`: canonical public origin used by metadata and sitemap.
- `PLAYWRIGHT_BASE_URL`: optional browser-test origin; it must use the same
  hostname as `AUTH_URL` for authenticated flows.
- `NEXT_PUBLIC_ANALYTICS_ID`: optional browser analytics destination identifier.
- `SPORTS_API_BASE_URL` / `SPORTS_API_KEY`: optional live sports adapter
  configuration; blank values retain labeled demo data.
- `ALLOW_PREVIEW_SEED`: explicit one-command preview seed gate; keep `false`
  except while manually seeding a disposable preview database.

The application validates this environment when the authentication boundary is
loaded. Never commit a populated `.env` file.


## Docker setup

FanTakes can run without a hosted Supabase dependency. The repository includes a
Docker Compose stack with PostgreSQL 16, an automatic Prisma migration job, and
the FanTakes application.

Create a local `.env` with at least:

```bash
POSTGRES_PASSWORD=replace-with-a-long-random-password
AUTH_SECRET=replace-with-a-long-random-auth-secret
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then start the stack:

```bash
docker compose up --build
```

PostgreSQL data is retained in the `fantakes_postgres_data` named volume. The
database port is bound to `127.0.0.1` by default so it is not exposed on every
network interface.

For migration from the existing hosted PostgreSQL database, follow
[`docs/DOCKER_POSTGRES_MIGRATION.md`](docs/DOCKER_POSTGRES_MIGRATION.md).

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Launch safeguards and current release gates are documented in [`docs/LAUNCH_HARDENING.md`](docs/LAUNCH_HARDENING.md).

Product contracts live in [`docs/`](docs/README.md), and implementation status
is maintained in [`docs/BUILD_PROGRESS.md`](docs/BUILD_PROGRESS.md).
Deployment and preview verification are documented in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and
[`docs/QA_CHECKLIST.md`](docs/QA_CHECKLIST.md).

## Deployment

Create a Vercel project, provide production environment variables, use a pooled
runtime `DATABASE_URL`, and run `prisma migrate deploy` once in a protected
release job before promotion. Never enable development auth in production.
Set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the exact deployment origin. For
Google login, register that origin's Auth.js callback URL in Google Cloud.

Recommended release commands are:

```bash
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
npm run db:deploy
```

The Vercel runtime must be connected to PostgreSQL. Google and SMTP remain
optional individually, but at least one production sign-in provider must be
configured. The active sports service uses ESPN adapters with persisted and stale-data fallbacks.
Tests use deterministic fixtures. Verify provider freshness in the deployed environment.

To seed an approved disposable preview database, set both database URLs to that
preview instance and run `npm run db:seed:preview`. Never add this command to the
production deployment pipeline and never set `ALLOW_PREVIEW_SEED=true` as a
persistent production environment variable.

Database-backed verification is opt-in:

```bash
RUN_DATABASE_TESTS=true node --env-file=.env.local \
  node_modules/vitest/vitest.mjs run tests/integration/database-flows.test.ts
RUN_DATABASE_E2E=true node --env-file=.env.local \
  node_modules/@playwright/test/cli.js test
```

For a disposable FanTakes-only database, prefer the guarded project command:

```bash
FANTAKES_TEST_DATABASE_URL="postgresql://..." npm run test:db:fantakes
```

It refuses a declared Production URL and requires an explicit override for
remote Supabase hosts. FanTakes verification does not use another project's
database, schema, scripts, or test harness.

The application is provider-neutral at the database layer: Prisma connects to
PostgreSQL directly and Auth.js uses the Prisma adapter. The current codebase
does not require the Supabase JavaScript SDK.
