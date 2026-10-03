# Supabase PostgreSQL to Docker PostgreSQL migration

FanTakes does not use the Supabase JavaScript SDK. The application talks to PostgreSQL through Prisma, and Auth.js persists its adapter records in the same PostgreSQL database. That means the database provider can be changed without rewriting application features.

This document covers the safe path from the current hosted PostgreSQL database to the PostgreSQL service in `docker-compose.yml`.

## 1. Prepare local Docker secrets

Create a local `.env` file. It is ignored by Git.

```bash
POSTGRES_DB=fantakes
POSTGRES_USER=fantakes
POSTGRES_PASSWORD=replace-with-a-long-random-password
AUTH_SECRET=replace-with-a-long-random-auth-secret
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Do not reuse a production database password in local development.

## 2. Start PostgreSQL only

```bash
docker compose up -d db
docker compose ps
```

The database must report healthy before continuing.

## 3. Export the hosted database

Use the direct PostgreSQL connection string for the current hosted database, not a transaction-pooler URL.

```bash
export SOURCE_DATABASE_URL='postgresql://...'
pg_dump \
  --dbname="$SOURCE_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=fantakes-supabase.dump
```

Treat the dump as sensitive production data. Do not commit it.

## 4. Restore into Docker PostgreSQL

```bash
export TARGET_DATABASE_URL='postgresql://fantakes:YOUR_PASSWORD@127.0.0.1:5432/fantakes'
pg_restore \
  --dbname="$TARGET_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  fantakes-supabase.dump
```

If the target database is intentionally empty and `--clean` reports harmless missing-object messages, review the output before continuing.

## 5. Validate Prisma migrations and data

```bash
docker compose run --rm migrate
DATABASE_URL="$TARGET_DATABASE_URL" DIRECT_URL="$TARGET_DATABASE_URL" npm run test:db:fantakes
```

Also compare row counts for critical tables such as `User`, `Take`, `Game`, `Community`, `Prediction`, `Session`, and `Account`.

## 6. Start FanTakes against Docker

```bash
docker compose up -d app
docker compose logs -f app
```

Then verify sign-in, game pages, posting a take, comments/reactions, communities, predictions, notifications, moderation, and scheduled jobs.

## 7. Production cutover

For production, use a server or container platform with persistent volumes and automated backups. Before cutover:

1. Take a fresh source backup.
2. Put writes into a maintenance window or otherwise stop writes.
3. Perform a final dump and restore.
4. Run `prisma migrate deploy`.
5. Verify authentication and core write paths.
6. Change the production `DATABASE_URL` and `DIRECT_URL` to the new PostgreSQL host.
7. Keep the original hosted database read-only until the rollback window has passed.

Do not delete the source database immediately after the cutover.

## What is and is not being replaced

The Docker migration replaces the hosted PostgreSQL provider. FanTakes keeps:

- Prisma and the existing schema/migrations.
- Auth.js and the Prisma adapter.
- Existing application APIs and feature logic.
- Existing PostgreSQL-backed rate limiting and operational records.

The current codebase has no Supabase SDK dependency, so there is no Supabase Auth, Storage, Realtime, or Edge Function client integration to rewrite as part of this migration.
