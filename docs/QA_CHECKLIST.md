# FanTakes preview QA checklist

Last updated: 2026-07-23

## Evidence states

- **Passed locally**: exercised through the Next.js development server against
  Supabase.
- **Pending preview**: requires a successful Vercel deployment URL.
- **Blocked**: cannot run because Vercel blocks deployment before build.

## Public routes

The following passed local Chromium route checks with no HTTP error or browser
console error:

- Homepage
- Games and seeded game detail
- Debate Center and seeded debate detail
- Communities and seeded community detail
- Hall of Flame
- Seeded public profile
- Login and signup
- Help
- Community Guidelines
- Terms
- Privacy

Repeat every route against the Vercel preview after the access block is removed.

## Authenticated routes

Development login, session persistence, My Arena, Settings logout, and
protected-route redirection passed locally against Supabase.

The following remain pending preview or broader browser coverage:

- Fresh-user onboarding
- Game Room participation
- Debate creation and voting
- Community join/participation
- Profile editing
- Notification deep links
- Moderator action UI

Their server-authoritative mutation behavior is covered by the PostgreSQL
integration suite, but that is not equivalent to complete browser-flow evidence.

## Responsive sizes

Local Chromium checks passed at 320, 375, 390, 430, 768, 1024, 1280, and
1440 pixels with no homepage horizontal overflow. Desktop and mobile public
navigation smoke tests also pass.

After deployment, repeat at every width and verify:

- Navigation and mobile bottom actions remain reachable.
- Forms and dialogs fit the viewport.
- Sticky navigation does not hide content.
- Touch targets remain at least 44 by 44 pixels.
- Game Room controls remain reachable.
- Text and statistics do not clip or overlap.

## Safety and data

- Supabase migrations are additive and current.
- Seed execution is not part of deployment.
- Distributed rate limits use PostgreSQL and return `Retry-After`.
- Reports validate target existence.
- Normal users cannot execute moderation actions.
- Removal and restoration update content state transactionally.
- Warnings create moderation notifications.
- Temporary mutes block mutations until expiry.
- Bans block authenticated mutations.
- Every moderation effect creates an audit record.

## Deployment checklist

- [ ] Vercel GitHub identity/project access restored.
- [ ] Preview deployment succeeds.
- [ ] Required Preview environment keys are present.
- [ ] At least one production-safe authentication provider is configured.
- [ ] `ENABLE_DEV_AUTH=false`.
- [ ] `ALLOW_PREVIEW_SEED=false`.
- [ ] Runtime Supabase query succeeds.
- [ ] Auth callback and secure-cookie behavior pass on the preview origin.
- [ ] Public route sweep passes against preview.
- [ ] Authenticated route sweep passes against preview.
- [ ] Responsive sweep passes against preview.
- [ ] Build logs contain no secret values.
- [ ] Build logs contain no migration or seed execution.

Until these boxes are complete, the branch is locally preview-ready but the
hosted preview is not validated.
