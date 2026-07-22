# Games directory

## Purpose and users

Let any visitor find live, upcoming, and completed games and enter participation
quickly. Intended for public visitors and authenticated fans.

## Route, entry, exit, and access

- Route: `/games`; public and indexable.
- Entry: Navbar, Home, search, league/team links, shared filtered URL.
- Exit: game room, prediction, team/community, sign-in.

## Layout and exact section order

1. Navbar, H1 “Games”, date navigator Today/previous/next and date picker.
2. League filter chips and status tabs Live, Upcoming, Final.
3. Live games grouped by league.
4. Upcoming games grouped by start-time window.
5. Final games.
6. Load more / cursor pagination and footer.

Desktop uses sticky 280 px filter rail plus responsive two-card content grid.
Tablet places horizontal filters above two columns. Mobile uses sticky date/status
bar and one-column GameCards; filters open a sheet.

## Components and interactions

Navbar, Button, GameCard, tabs, chips, date input, Modal sheet, skeleton, empty
and error states. Filters update query parameters without losing scroll
unnecessarily. Hover/focus/active/disabled follow shared contracts. Date controls
disable beyond configured schedule window with explanation.

Loading preserves groups. Empty distinguishes no games from active filters and
offers Clear filters. Partial league failure shows local retry. Offline shows
cached date with stale label and disables follow/predict; route navigation remains.

## Permissions and data/API

Public `GET /api/v1/games?status&league&date&cursor`; personalized follow state is
included only through private server composition/no shared cache. Scores include
source update time. Auth required only for follow/prediction.

## Analytics

`games_view`, `games_date_changed`, `games_filter_changed`, `game_open`,
`game_follow`, `prediction_start`; dimensions contain filter/placement/entity ID.

## Accessibility and SEO

Tabs are links with current state; grouped lists have headings; date control has
explicit label; no horizontal keyboard trap. Canonical URL omits default filters;
arbitrary filtered/search pages noindex as appropriate. SportsEvent structured
data uses only verified game facts.

## Acceptance criteria and tests

- Live/upcoming/final grouping and timezone boundary behavior.
- Query persistence, clear filters, browser back/forward, pagination.
- Score stale/upstream error/offline/no-game states.
- Signed-out protected actions return correctly after auth.
- 320/768/1440 layout, keyboard filters, accessible names, SEO metadata.

## Assumptions and decisions

Dates display in user timezone while queries use explicit local date plus timezone
resolved server-side. Infinite auto-loading is not required; Load more remains.
