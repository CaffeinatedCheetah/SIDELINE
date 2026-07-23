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

- `DATABASE_URL`: PostgreSQL runtime and migration connection.
- `AUTH_SECRET`: random secret of at least 16 characters.
- `AUTH_URL`: deployed Auth.js callback origin.
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`: optional Google OAuth pair.
- `EMAIL_SERVER` / `EMAIL_FROM`: optional SMTP transport for magic links.
- `ENABLE_DEV_AUTH`: local seeded-account provider; must be `false` in production.
- `NEXT_PUBLIC_APP_URL`: canonical public origin used by metadata and sitemap.

The application validates this environment when the authentication boundary is
loaded. Never commit a populated `.env` file.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Product contracts live in [`docs/`](docs/README.md), and implementation status
is maintained in [`docs/BUILD_PROGRESS.md`](docs/BUILD_PROGRESS.md).

## Deployment

Create a Vercel project, provide production environment variables, use a pooled
runtime `DATABASE_URL`, and run `prisma migrate deploy` once in a protected
release job before promotion. Never enable development auth in production.

Recommended release commands are:

```bash
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
npx prisma migrate deploy
```

The Vercel runtime must be connected to PostgreSQL. Google and SMTP remain
optional individually, but at least one production sign-in provider must be
configured. Sports data is currently supplied only by deterministic development
seed records; no live sports provider is claimed or configured.
