# Game Card

## Purpose

Summarize a game and make live participation the primary destination.

## Inputs

Game ID, league, scheduled time, status, home/away team names/logos, scores,
period/clock, optional stale timestamp, conversation count, prediction state,
follow state, and destination URL.

## Variants and sizes

- `compact`: horizontal list, minimum 112 px high.
- `standard`: default directory card, 168–220 px.
- `featured`: hero-width with larger score and conversation preview.
- Status variants: scheduled, live, final, postponed, canceled.

Typography: league `caption`, teams `body/label`, score `heading-1` tabular,
status `label`. Surface-2, subtle border, `md` radius, 16–20 px padding. Live
uses red badge and left accent; final uses neutral styling.
Spacing is 8 px for metadata, 12 px between teams, and 16 px before actions.
Team, status, follow, and prediction icons follow `design/ICONS.md`.

## Visible controls

Whole title/score region links to game room. Separate Follow toggle and, before
lock, Make prediction button are keyboard-reachable and must not nest inside the
card link. Conversation count links to the game-room conversation anchor.

## Interaction and states

Hover raises border to strong and surface to surface-3; focus ring surrounds the
specific control; active uses 1 px press. Follow loading disables only follow.
Skeleton mirrors teams/score. Missing logo uses initials. Upstream error shows
last known score and “Updated …” warning; no data shows retry. Offline retains
cached content and disables follow/prediction.
Disabled controls name the lock, permission, final-state, or offline reason.

## Responsive and accessibility

Mobile places score between stacked teams and moves metadata below; no essential
horizontal clipping. Team logo is decorative beside visible name. Accessible
name includes teams, status, score or start time. Score updates announce a
throttled summary, not each digit. Status never relies on color.
Screen reader behavior is tested for the card link and sibling controls as
separate accessible actions.

## Usage and misuse

Use for game discovery and related-game modules. Do not use as a news article,
omit team names in favor of logos, display invented live status, or make nested
interactive elements invalid.

## Acceptance criteria

All statuses render deterministically; times respect user timezone with UTC in
machine markup; card controls are independent; stale/offline behavior is clear;
layout passes 320 px and 200% zoom; loading causes no significant layout shift.
