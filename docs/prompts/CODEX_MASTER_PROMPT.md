# FanTakes Codex master prompt

You are implementing FanTakes in the `sideline` repository.

## Product source of truth

Read `docs/README.md`, `PRODUCT_VISION.md`, `INFORMATION_ARCHITECTURE.md`,
`USER_FLOWS.md`, `DESIGN_SYSTEM.md`, `COMPONENT_LIBRARY.md`, `DATABASE_SCHEMA.md`,
`API_SPEC.md`, and `ROADMAP.md`, then the relevant page/component/design files.

The product principle is:

> Scores bring fans in. Conversations keep them. Identity brings them back.

Prioritize live participation, fan conversation, debate, community, prediction,
reputation, and identity. Maintain the premium black-and-red design; do not turn
FanTakes into a generic sports news site.

## Repository truth

Documentation records the target contract, not proof that code exists. Before
every task, inspect the actual repository, package manifest, routes, database,
components, tests, CI, and deployment files. Report mismatches. Never claim an
integration or behavior exists unless code and verification establish it.

## Required architecture

- Next.js App Router, React, strict TypeScript.
- Server Components by default; client boundaries only for interaction.
- PostgreSQL/Prisma and reviewed forward migrations.
- Auth.js; server-derived identity and authorization.
- Tailwind mapped to semantic CSS tokens; no raw design values in features.
- `/api/v1` Route Handlers with shared services and Zod boundaries.
- Vitest/Testing Library and Playwright.
- Vercel preview/production workflow with environment validation.

If the repository has an approved different implementation, stop and report the
conflict instead of silently replacing it.

## Work protocol

1. Read applicable specifications completely.
2. Inspect current code and working-tree status; preserve unrelated changes.
3. State the smallest dependency-complete plan.
4. Implement shared primitives before page-local duplication.
5. Enforce authorization in server services, never only in UI.
6. Implement default, hover, focus, active, disabled, loading, empty, error, and
   offline states required by the spec.
7. Add tests at the lowest useful level plus critical E2E coverage.
8. Run format, lint, typecheck, unit/integration tests, build, accessibility
   checks, migration validation, and scoped E2E tests configured by the repo.
9. Review for security, accessibility, responsive behavior, privacy, and stale
   documentation before reporting.

## Non-negotiable implementation rules

- Never invent scores, live status, reputation, permissions, or provider data.
- Never trust client ownership, role, account status, lock time, or counts.
- Do not log tokens, cookies, email, authored content, report detail, or search
  query text.
- Preserve user text; do not normalize meaningful Unicode beyond documented line
  ending/emptiness handling.
- Use semantic HTML, visible focus, keyboard operation, and WCAG 2.2 AA contrast.
- Respect reduced motion and 320 px/200% zoom.
- No optimistic authored-content creation; reactions/follows may be optimistic
  with rollback.
- Use stable IDs, opaque cursors, idempotency for specified writes, and UTC storage.
- Keep public and private caching distinct; private responses are no-store.
- Never expose private-resource existence through error differences.
- Keep source adapters replaceable; do not couple domain schema to vendor payload.

## Scope control

Unless a task explicitly changes the approved scope, do not add payments,
wagering, prizes, native apps, direct messages, uploads, livestreaming, private
communities, AI judging, automatic punishment, public third-party APIs, webhooks,
or WebSockets. Do not add abstractions for deferred features.

## Decision handling

When a genuine ambiguity is not resolved by the docs:

1. prefer the simplest secure and maintainable behavior;
2. ensure it preserves accessibility and server authorization;
3. record the decision under “Assumptions and decisions” in the relevant file;
4. stop for user input if the choice changes product meaning, privacy, legal
   posture, external cost, or irreversible data shape.

## Completion report

Lead with the outcome. Include files changed, behavior implemented, migrations,
security/accessibility decisions, tests and exact results, unresolved blockers,
and working-tree status. Do not commit or push unless explicitly authorized.
