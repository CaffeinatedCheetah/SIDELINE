# Launch hardening

This change replaces historical readiness claims with explicit verification gates.

## Behavior

- Scout publishing rejects missing cron credentials and takes an expiring database lease.
- Personalized briefings require sign-in, enforce per-user quotas, and use private/no-store responses.
- Every paid AI request reserves its conservative maximum cost atomically. Failed or interrupted attempts retain their reservation for the UTC day. Model-specific prices must be configured explicitly; a key alone cannot enable spending. Reservations are conservative estimates, not provider invoices.
- JWT sessions re-check active account status. Suspended and pending-deletion accounts cannot reuse an old session to mutate settings or privileged AI routes.
- Search, direct user APIs, feed reads, comments, reactions and replies enforce additional visibility/block rules. Open predictions are hidden from other users until their lock time.
- A daily deletion worker anonymizes due accounts after the 14-day grace period, removes credentials/profile data and authored text, and preserves anonymized integrity/safety records.
- Content and score writes are transactional for take creation, comment rewards and reaction toggles. Eligible posting rewards are limited to ten per user per UTC day, require at least twenty characters and exclude recent duplicate bodies.
- Release dashboard marks acceptance as unverified instead of reporting hard-coded passes.
- PostgreSQL integration and authenticated desktop/mobile browser journeys run in CI against a disposable PostgreSQL 16 service. Browser journeys use the production build with isolated preview-only fixture authentication; flaky results fail the gate.
- Next.js, Vitest, Playwright and dependency security patches are updated. Explicit transitive overrides need revalidation when upgrading Auth.js/Prisma.

## Deployment

Apply the new launch-safeguards migration before deploying application code. The normal Vercel production build performs migrations and runtime schema verification.

Required operational configuration: DATABASE_URL, DIRECT_URL, AUTH_SECRET, exact AUTH_URL and NEXT_PUBLIC_APP_URL, CRON_SECRET, plus Google OAuth and/or SMTP. Development auth must remain disabled in production.

AI requires model, input/output USD-per-million rates and daily caps for its provider, as documented in .env.example. Use verified current prices for the configured model. Changing the model without approving its pricing fails closed.

Vercel schedules Scout daily, Hall of Flame daily, account deletion daily, sports sync every five minutes and recap processing every fifteen minutes. Confirm the hosting plan supports these frequencies before promotion. AI jobs remain disabled without their feature flags/pricing. Request-time refresh still handles interactive score updates.

## Release gates

1. Clean install, Prisma generation, lint, types, full tests, production build and dependency audit.
2. Disposable database migration, repeatable seed, concurrency/privacy/deletion/budget integration checks.
3. Desktop/mobile sign-in, navigation, posting, following, predictions and accessibility.
4. Preview verification with the actual production provider configuration, job credentials, routing, database and email/OAuth delivery.
5. Confirm migration history, backup/restore procedures, operational alerts and provider spend dashboards.

No production database, paid AI request or deployment is changed by local tests. CI fixtures must never point at the production database.

## Scope of unfinished surfaces

Legacy root HTML and api/*.js files are not the canonical Next.js application. They are retained for reference pending a deployment/traffic check. Game Pulse now uses actual thread counts and optional KV presence; unavailable presence is shown as unknown. Catch-up and debate-summary helpers remain experimental and are not claimed as released product features. Data export and multi-device session management remain explicitly unavailable.
