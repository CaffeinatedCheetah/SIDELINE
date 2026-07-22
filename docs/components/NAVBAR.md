# Navbar

## Purpose

Provide stable global navigation, search, identity, and notification access.

## Inputs

Current pathname, authenticated user summary, unread count, navigation items,
and callbacks for mobile menu and sign-out. Data is server-derived.

## Variants and layout

- Desktop (`>=1024`): 64 px sticky top bar, logo left, primary links center-left,
  search and account actions right.
- Tablet: logo, compact links, search icon, account actions.
- Mobile: 56 px top bar with logo/search/menu plus 64 px bottom navigation.
- Signed out: Sign in replaces notifications/profile; public links remain.

Typography uses `label`; background `surface-1`; 1 px bottom border; no radius.
Active item has primary text, red 2 px indicator, and `aria-current=page`.
Colors use semantic tokens; spacing is 24 px between desktop groups and 8–12 px
inside compact groups while every control retains a 44 px target.

## Interaction states

Hover uses `surface-3`; focus uses global ring; active press uses `surface-2`.
Unread badge uses brand plus numeric label capped visually at `99+`. Loading uses
fixed-size avatar and nav skeletons. Error hides unread count but retains link.
Offline state retains navigation and marks network-dependent actions in pages.
Disabled items remain labeled and expose the unavailability reason.

## Keyboard and screen reader

Starts with a Skip to content link. Navigation uses `<nav aria-label="Primary">`.
Tab order follows visual order; mobile menu traps focus only while open and
restores it to trigger. Escape closes menu. Logo label is “FanTakes home”.

## Usage and misuse

Use once per application shell. Do not place page filters, scores, marketing
promotions, or arbitrary community links in global navigation. Do not duplicate
the same destination in top and bottom navigation unless responsive visibility
makes only one available.

## Acceptance criteria

Correct active state for every route; no eager protected-data fetch when signed
out; 25-character handles truncate visually but remain fully named; menus work
by keyboard/touch; safe-area and sticky behavior do not obscure content; all
destinations remain reachable at 320 px.
