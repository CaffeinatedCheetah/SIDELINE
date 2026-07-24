# Community Card

## Purpose

Summarize a community's identity, focus, membership, activity, and rules signal.

## Inputs

Slug/name, avatar/banner accent, description, visibility, member count, recent
activity count, team/league tags, membership state, rules summary, URL, and join
permission.

## Variants and visual rules

`standard` directory card, `compact` recommendation row, `featured` promotional
panel. Heading uses heading-3, description body-sm, metadata caption. Surface-2,
subtle border, `md` radius, 16–20 px padding; optional team color is a 4 px accent.
Spacing is 12 px between identity and description, 8 px within metadata, and
16 px before actions. Community, team, and menu icons use approved mapping.

## Controls and states

Identity links to community. Join/Joined is separate and confirms rule acceptance
when first joining. Hover strengthens border; focus is per link/button; active
membership uses pressed state. Loading disables only membership control. Error
rolls back optimistic state. Empty description is replaced with topical tags,
not invented copy. Offline disables join/leave.
Disabled membership controls explain authentication, moderation, ownership, or
offline constraints.

## Responsive and accessibility

At mobile width, metadata wraps and join becomes full-width only below 360 px.
Counts have readable labels. Avatar is decorative beside visible name. Visibility
and membership are textual badges.
Screen reader behavior exposes name, description, counts, visibility, and
membership state once while hiding decorative imagery.
Typography uses only the shared heading-3, body-sm, label, and caption tokens.

## Usage and misuse

Use in community directory and recommendations. Do not imply membership from a
follow, hide rules behind joining, expose private membership details, or use team
color as the primary action color.

## Acceptance criteria

Public/member/moderator/owner states, count pluralization, long names, absent
images, loading/error/offline, keyboard flow, and 320 px layout pass tests.
