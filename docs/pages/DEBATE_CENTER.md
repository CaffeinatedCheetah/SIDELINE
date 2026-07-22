# Debate Center

## Purpose and users

Help fans discover structured, active sports disagreements and enter a declared
position. Public visitors browse; authenticated fans create and participate.

## Route, entry, exit, and access

- Route: `/debates`; public and indexable.
- Entry: Navbar, Home, game room, community, search.
- Exit: debate detail, game/community, creator profile, sign-in/create flow.

## Layout and exact section order

1. Navbar, H1, explanatory sentence, Start a debate button.
2. Featured debate with positions and participation totals.
3. Tabs Active, Closing soon, Resolved; sport/community filters.
4. Debate list: title, context, position distribution, participant/take counts,
   close time, creator/community.
5. Load more.
6. Debate rules explainer and footer.

Desktop has filter rail and 2-column list; tablet moves filters above; mobile uses
one column and filter sheet. Featured content never auto-rotates.

## Interaction and states

Filters update URL. Start debate opens auth-aware modal/form with prompt, 2–4
positions, optional context, close time, and rules acknowledgement. Shared states
apply. Loading uses fixed cards. Empty filter offers Clear; global empty explains
debates and creation. Partial errors are local. Offline permits cached reading and
disables create/join.

## Permissions and data/API

Public debate GET collection; creation endpoint is a required extension of
`POST /api/v1/debates` with active authenticated account and rate limit; position
selection via PUT. Removed/private context is excluded. Creation may be disabled
for new/suspended accounts with explanation.

## Analytics

`debate_center_view`, `debate_filter`, `debate_open`, `debate_create_open`,
`debate_created`; no prompt text.

## Accessibility and SEO

Position distribution includes values/text, not chart color only. Closing time
uses semantic `<time>`. Filters are labeled. Canonical defaults, metadata, and
collection breadcrumb structured data are required; arbitrary filtered URLs may
be noindex.

## Acceptance criteria and tests

- Active/closing/resolved ordering and timezone handling.
- URL filter/back behavior and cursor pagination.
- Create validation, permission, rate limit, duplicate submission.
- Empty/loading/error/offline and private-context exclusion.
- Keyboard filter/modal, chart text equivalents, 320/1440 layout, SEO.

## Assumptions and decisions

Debates support 2–4 positions. Formal scoring or AI adjudication is deferred;
resolved means participation is closed, not that FanTakes declares a winner.
