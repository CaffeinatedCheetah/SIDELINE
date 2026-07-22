# FanTakes product and implementation specifications

FanTakes is the product built in the `sideline` repository. These documents are
the implementation contract until executable application code exists.

> Scores bring fans in. Conversations keep them. Identity brings them back.

## Repository state

At the time of this specification, the repository contains documentation only.
There is no application framework, route implementation, component library,
database, authentication provider, API, test runner, CI workflow, or deployment
configuration. Statements labeled **Required** describe work to implement;
nothing in these documents should be read as existing runtime behavior unless
it appears under **Existing**.

## Status vocabulary

- **Existing:** observable in the repository now.
- **Required:** in Version 1 implementation scope.
- **New:** required behavior with no current implementation.
- **Deferred:** intentionally excluded from Version 1.
- **Decision:** an adopted default that removes ambiguity.

## Reading order

1. [Product vision](PRODUCT_VISION.md)
2. [Information architecture](INFORMATION_ARCHITECTURE.md)
3. [User flows](USER_FLOWS.md)
4. [Design system](DESIGN_SYSTEM.md)
5. [Component library](COMPONENT_LIBRARY.md)
6. [Database schema](DATABASE_SCHEMA.md)
7. [API specification](API_SPEC.md)
8. [Roadmap](ROADMAP.md)

Page specifications live in `pages/`, reusable UI contracts in `components/`,
visual tokens in `design/`, and coding-agent instructions in `prompts/`.

The page set covers Home, Games, Game Room, My Arena, authentication, Debate
Center/detail, Communities/detail, Profile, Hall of Flame, Search, Notifications,
and Settings.

## Adopted implementation baseline

- Next.js App Router and React with strict TypeScript.
- Server Components by default; Client Components only for interaction.
- Tailwind CSS backed by CSS custom-property design tokens.
- PostgreSQL with Prisma migrations and generated client.
- Auth.js sessions with email magic link and Google OAuth.
- Route Handlers under `/api/v1`; Zod at every external boundary.
- Vercel for web deployment and managed PostgreSQL for data.
- Vitest and Testing Library for units/components; Playwright for critical flows.

These are decisions, not existing integrations. Secrets, providers, and domains
must be configured by the deployment owner.

## Cross-cutting requirements

### Accessibility

Target WCAG 2.2 AA. All functionality must work by keyboard, preserve visible
focus, expose semantic names and errors, support 200% zoom, honor reduced
motion, and meet contrast requirements. Live score changes use polite live
regions; moderation and destructive actions require explicit confirmation.

### Moderation

Version 1 includes report, block, mute, content state, moderator review queue,
reason codes, audit events, and appeal status. Automated toxicity scoring and
automatic punishment are deferred. A report never publicly reveals the reporter.

### Security

Apply least privilege, server-side authorization, CSRF protection, secure
cookies, rate limits, schema validation, output escaping, Content Security
Policy, safe redirects, audit logging for privileged actions, and secret
isolation. Never trust client role, score, reputation, or ownership claims.

### Testing

Every requirement needs a unit, integration, component, accessibility, or E2E
test at the lowest useful level. Critical E2E flows are authentication, game
participation, take creation, debate participation, reporting/blocking, settings,
and account deletion. CI blocks merge on typecheck, lint, tests, build, migration
validation, accessibility smoke tests, and formatting.

### Deployment

Use preview deployments per pull request, a protected production environment,
forward-only database migrations, environment validation at startup, structured
logs, error monitoring, health checks, and documented rollback. Deployment must
not silently run migrations from multiple application instances.

## Change control

When code and documentation disagree, confirm whether the code is an approved
change. Update the relevant specification in the same change set. Avoid copying
shared token or component rules into pages; pages reference the shared contract
and specify only composition and page-specific behavior.
