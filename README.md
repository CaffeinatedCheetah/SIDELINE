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
