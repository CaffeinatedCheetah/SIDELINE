# FanTakes — Manual QA Checklist (Shell + Purple Rebrand)

Automated browser, visual regression, and accessibility (axe) execution is
not available in the environment this branch was built in. This checklist
is the external verification step referenced in the engineering report for
PR `claude/shell-purple-rebrand`.

## How to use this
Open the Preview deployment and go through each route at each breakpoint.
Check off each row; note any failure with the route + breakpoint + what broke.

## Breakpoints
320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440px

## Routes and what to verify

| Route | Shell (sidebar) expected? | Check |
|---|---|---|
| `/` (Homepage) | Yes | Hero, Today's Schedule, Trending Takes, Debates, Communities, Hall of Flame preview all render; purple accents; no red bleeding through except semantic states |
| `/games` | Yes | League/status filters work; LIVE badge is red/danger tone, not purple — confirm semantic red preserved |
| `/games/[gameId]` (Game Room) | Yes | Chat/Takes/Polls/Stats tabs; right rail renders if content registered |
| `/debates` | Yes | List renders; vote bars use purple |
| `/debates/[debateId]` | Yes | Voting works; focus ring visible on keyboard nav |
| `/debates/new` | Yes | Form controls consistent with design system |
| `/communities` | Yes | Cards consistent with GameCard/DebateCard styling |
| `/communities/[slug]` | Yes | Join button purple; tabs consistent |
| `/hall-of-flame` | Yes | Rank vs. score terminology matches homepage preview fix |
| `/users/[handle]` (Profile) | Yes | Follow button purple; stats readable |
| `/arena` (My Arena) | Yes | Sidebar active state highlights "My Arena" |
| `/notifications` | Yes | Sidebar active state highlights correctly |
| `/search` | Yes | Sidebar active state; keyboard focus on result list |
| `/settings` | Yes | Form controls, no dead toggles |
| `/moderation` | Yes | Reports list; action buttons consistent |
| `/help` | No (full-bleed, intentional) | Content readable without sidebar; search works |
| `/terms`, `/privacy`, `/guidelines` | No (full-bleed, intentional) | Long-document readability; headings hierarchy |
| `/auth/sign-in`, `/auth/sign-up`, `/auth/error` | No (full-bleed, intentional) | Forms centered; no orphaned sidebar space |

## Cross-cutting checks (every page)
- [ ] Left sidebar active state matches current route
- [ ] Mobile bottom nav active state matches current route
- [ ] Tab key reaches every interactive control in visual order
- [ ] Focus ring (`--focus`, purple) visible on every focusable element
- [ ] No emoji or placeholder/Lorem-ipsum text
- [ ] No dead links (every link resolves)
- [ ] Loading state does not flash unstyled content
- [ ] Empty state copy is specific, not a generic "No data"
- [ ] Error state (simulate by blocking API calls) shows a real message, not a blank page
- [ ] Red is only used for errors/destructive/live-alerts, never as a brand accent
- [ ] Green only for success/positive deltas
- [ ] Yellow/orange only for warnings/streaks/flame features

## Known gap
- `/games/[gameId]` Game Room right-rail content (Live Stats / Trending Fans /
  Predictions) depends on `useRightRail` being called by that page's own
  components — confirm it's actually wired there, since this checklist can't
  execute the page to verify at write time.
