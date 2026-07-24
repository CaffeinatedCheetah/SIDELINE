# FanTakes deployment

Last verified: 2026-07-23

## Deployment target

The GitHub source is `CaffeinatedCheetah/SIDELINE` on the
`claude/fantakes-v1-implementation` preview branch. Vercel receives branch
status events, but currently blocks the deployment before installation with an
account/project-access failure. No preview URL has been issued.

The repository declares the deployment contract in `vercel.json`:

- Root directory: repository root.
- Framework: Next.js.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Output directory: managed by the Next.js Vercel adapter; no custom directory.
- Node.js: 22.x from `package.json`.
- Prisma: `postinstall` runs `prisma generate`.
- Database migrations: never run as part of install or build.

## Required Vercel settings

Set these separately for Preview and Production. Values belong in Vercel, not
Git:

- `DATABASE_URL`: Supabase transaction-pool URL, port 6543, with
  `pgbouncer=true&connection_limit=1`.
- `DIRECT_URL`: direct Supabase PostgreSQL URL, port 5432, for protected
  migration jobs only.
- `AUTH_SECRET`: independent cryptographic secret.
- `AUTH_URL`: exact canonical deployment origin.
- `NEXT_PUBLIC_APP_URL`: same canonical origin.
- `ENABLE_DEV_AUTH=false`.
- `ALLOW_PREVIEW_SEED=false`.

Configure either Google (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`) or email
(`EMAIL_SERVER`, `EMAIL_FROM`) authentication. Analytics and sports-provider
variables are optional.

Vercel automatically supplies `VERCEL=1`, which Auth.js accepts as a trusted
host signal. Provider callback allowlists must still contain the exact deployed
callback origin.

## Database safety

The current development/preview validation uses the existing Supabase project,
not an isolated per-branch database. Two additive migrations are applied and
schema drift is absent. The database must not be reset or automatically seeded.

Preview seed data already exists and was verified idempotent. No additional
preview seed is required. If an isolated preview database is created later, run
`npm run db:seed:preview` once with `ALLOW_PREVIEW_SEED=true`, then immediately
return the variable to `false`.

## Release procedure

1. Link the GitHub account under Vercel Account Settings → Authentication →
   Login Connections.
2. Confirm that account has access to the Vercel project connected to
   `CaffeinatedCheetah/SIDELINE`.
3. Configure Preview variables without exposing their values.
4. Redeploy the latest feature-branch commit.
5. Inspect install/build logs for `npm ci`, Prisma generation, and the Next.js
   build. Confirm no migration or seed command runs.
6. Run the route and responsive checks in `QA_CHECKLIST.md` against the issued
   preview URL.
7. Configure a stable preview/custom origin before enabling Google or email
   callback testing.

Production promotion and merging to `main` remain out of scope.

## Current blocker

Vercel reports `Deployment Blocked` before build. The latest commit is correctly
associated with the `CaffeinatedCheetah` GitHub identity, so repository-local
author metadata is no longer the cause. Vercel project membership/login
connection must be corrected in the dashboard before deployment validation can
continue.
