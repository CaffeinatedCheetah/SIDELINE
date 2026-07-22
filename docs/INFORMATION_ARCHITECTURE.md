# Information architecture

## Existing behavior

No framework or routes exist. The following route map is required.

## Route map

| Route | Page | Access | Indexing |
|---|---|---|---|
| `/` | Public homepage | Public | Index |
| `/games` | Games directory | Public | Index |
| `/games/[gameId]` | Game room | Public read; auth to participate | Index when canonical game data exists |
| `/arena` | My Arena | Authenticated | Noindex |
| `/debates` | Debate Center | Public | Index |
| `/debates/[debateId]` | Debate detail | Public read; auth to participate | Index |
| `/communities` | Community directory | Public | Index |
| `/communities/[slug]` | Community detail | Public or member-only by visibility | Conditional |
| `/users/[handle]` | Public profile | Public unless restricted | Index |
| `/hall-of-flame` | Hall of Flame | Public | Index |
| `/search` | Search | Public | Noindex |
| `/notifications` | Notifications | Authenticated | Noindex |
| `/settings` | Settings | Authenticated | Noindex |
| `/auth/sign-in` | Sign in | Signed-out | Noindex |
| `/auth/verify` | Verification result | Public token flow | Noindex |
| `/auth/error` | Authentication error | Public | Noindex |

## Navigation model

Desktop global navigation order: FanTakes logo, Games, Debates, Communities,
Hall of Flame, search, notifications, profile menu. Signed-out users see Sign in
as the final action. My Arena appears as the first authenticated destination in
the profile menu and compact mobile navigation.

Mobile bottom navigation contains Home, Games, Create, Notifications, and
Profile. Create opens an accessible action sheet for Take, Prediction, or Debate
and requires authentication. Communities, Hall of Flame, Search, My Arena, and
Settings are in the menu sheet.

## Content model

- A **Sport** contains leagues.
- A **League** contains teams and games.
- A **Game** supplies context for takes, predictions, and game-room membership.
- A **Take** is an authored statement, optionally attached to a game, debate,
  community, or parent take.
- A **Prediction** records a proposition, choice, lock time, and resolution.
- A **Debate** has two or more explicit positions and associated takes.
- A **Community** has visibility, rules, members, roles, and scoped content.
- A **Profile** aggregates identity, interests, participation, and reputation.

## URL and identity rules

- Database IDs are UUIDs; human routes use stable opaque IDs for games/debates
  and normalized unique slugs/handles for communities/users.
- Handles are 3–24 ASCII letters, digits, or underscores; comparison is
  case-insensitive and display preserves chosen case.
- Community slugs are lowercase ASCII kebab-case, 3–48 characters.
- Query parameters hold filters and pagination cursors so views are shareable.
- Removed public content retains a tombstone route when reply integrity requires
  it; private or unauthorized content returns 404 to avoid disclosure.

## Data ownership and permission tiers

- Public: read public games, debates, communities, profiles, and eligible takes.
- Authenticated: react, follow, predict, report, and create generally available
  content.
- Member: contribute where community membership is required.
- Moderator: manage scoped reports and content within assigned communities.
- Administrator: platform-wide moderation and operational controls.

## Cross-page state

Authentication and preference state are server-derived. Filters use URLs.
Optimistic reactions may update locally and reconcile with API output. Live game
state uses polling with visibility-aware backoff. No global client store is
required until shared interactive state proves necessary.

## Assumptions and decisions

- Public pages render on the server for performance and SEO.
- Personalized/private pages are dynamic and never cached publicly.
- Unknown or unauthorized private resources use the same 404 surface.
- Creation flows use route-aware modal sheets on desktop/mobile while preserving
  a navigable fallback URL.
