# Settings

## Purpose and users

Let authenticated users control profile, interests, notifications, privacy,
safety relationships, accessibility/data use, sessions, and account lifecycle.

## Route, entry, exit, and access

- Route: `/settings?section=`; authenticated; noindex/no-store.
- Entry: Navbar/profile menu, profile edit, notification settings.
- Exit: profile, blocked user profile when permitted, Home after sign-out.

## Layout and exact section order

1. Navbar, H1.
2. Desktop settings nav / mobile section select: Profile, Teams & interests,
   Notifications, Privacy & safety, Accessibility & data, Sessions, Account.
3. Active section form.
4. Sticky save bar only when dirty; Cancel/reset.
5. Account danger zone last.

Desktop uses 240 px nav plus 680 px form. Tablet uses compact side nav. Mobile
uses select/list navigation, single column, and safe-area-aware save bar.

## Visible controls and behavior

Profile fields; team selectors; notification checkboxes; profile discoverability;
mute/block lists with remove buttons; reduced data/motion preference (system
default or explicit); active sessions with Revoke; Request account deletion.
Forms follow shared states. Unsaved navigation triggers accessible confirmation.
Sensitive changes require recent auth. Each section saves independently.

Interaction behavior uses shared Forms, Button, Modal, menu, and focus contracts.
Hover, focus, active, disabled, and loading states remain consistent across
settings sections.

Loading uses field skeletons; empty block/mute/session list uses neutral message.
Server error retains changes and focuses summary. Conflict refresh offers review,
not silent overwrite. Offline permits editing draft but disables save/revoke/delete
and labels unsynced state.

## Permissions and data/API

Own profile/settings GET/PATCH, blocks/mutes DELETE, session endpoints through
Auth.js/internal service, account deletion POST. Server ignores client actor ID,
validates allowed settings, and audits session/deletion operations.

## Analytics

`settings_view`, `settings_section`, `settings_saved` with section only,
`session_revoked`, `account_deletion_started/canceled`; never preference values,
blocked IDs, email, or deletion reason.

## Accessibility and SEO

Visible labels, grouped fieldsets/legends, error summary, dirty-state announcement,
keyboard-accessible multi-select, destructive confirmation safe focus. Page is
noindex/no-store and excluded from sitemap.

## Acceptance criteria and tests

- Every section load/save, dirty navigation, optimistic conflict, auth expiry.
- Block/mute removal, current/other session revoke, recent-auth requirement.
- Account deletion 14-day state, session sign-out, cancellation policy.
- Loading/empty/error/offline, 320/768/1440, keyboard/screen reader, cache headers.

## Assumptions and decisions

Privacy defaults to public profile with private email. Exact legal export/deletion
copy requires policy-owner approval but the secure workflow is Version 1 scope.
