# Search

## Purpose and users

Find public games, debates, communities, and profiles from one predictable
surface. Available to public and authenticated users.

## Route, entry, exit, and access

- Route: `/search?q=&type=`; public, always noindex.
- Entry: Navbar search, mobile search action, direct URL.
- Exit: result entity, filtered search, previous route.

## Layout and exact section order

1. Navbar and H1.
2. Search form with clear and submit buttons.
3. Type tabs All, Games, Debates, Communities, People.
4. Result count/summary.
5. Grouped All results or one typed list using shared cards.
6. Load more.
7. Empty-state suggestions and safety/privacy note.

Desktop max 960 px with optional filter rail; tablet/mobile one column. Search
input remains visible/sticky below header on mobile.

## Interaction and states

Submit or 300 ms debounced suggestions after two characters; full results require
submission and URL update. Arrow keys navigate suggestion list, Escape closes,
Enter chooses. Clear resets URL/results. Loading retains prior results with busy
indicator. Empty distinguishes no query and no matches. Errors retain query and
retry. Offline may show recent local destinations but never claim live results.

## Permissions and data/API

`GET /api/v1/search?q&type&cursor`; server searches public active entities and
applies block/mute/visibility filters. Query 2–100 chars; no email/private lookup.
Search history is local and clearable; server analytics does not retain query text.

## Analytics

`search_submitted` with query length bucket/type, `search_type_changed`,
`search_result_open` with entity/position; never raw query.

## Accessibility and SEO

Combobox follows ARIA pattern; result summary is polite after submit; focus does
not jump on each keystroke. Page and all query variants use noindex; canonical is
`/search` without query.

## Acceptance criteria and tests

- Minimum/maximum/control-character validation, Unicode query.
- All/type result grouping, pagination, permission filtering.
- Suggestion keyboard/escape/click-outside and race cancellation.
- Loading/empty/error/offline, 320 px, screen reader, noindex.

## Assumptions and decisions

Version 1 uses PostgreSQL search and deterministic relevance/recency tie-breaks.
Authored take full-text search is deferred pending privacy/moderation review.
