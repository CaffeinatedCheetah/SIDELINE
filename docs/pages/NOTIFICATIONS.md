# Notifications

## Purpose and users

Give authenticated fans an actionable, controlled record of replies, mentions,
prediction results, followed games, community activity, and safety updates.

## Route, entry, exit, and access

- Route: `/notifications`; authenticated active or limited suspended account;
  noindex/no-store.
- Entry: Navbar badge, mobile nav, email deep link.
- Exit: referenced entity, notification settings, profile/menu.

## Layout and exact section order

1. Navbar, H1, unread count, Mark all read, Settings link.
2. Tabs All, Replies, Predictions, Games, Communities, Safety.
3. Notifications grouped Today, Earlier this week, Older.
4. Load more.

Desktop max 800 px; tablet/mobile one column. Mobile rows use 56 px avatar/icon,
wrap message, and keep timestamp visible.

## Interaction and states

Opening a notification marks it read only after successful navigation intent;
Mark all read confirms for large count and is idempotent. Unread row uses border,
dot, and accessible text. Hover/focus/active follow shared rules. Loading uses
rows. Empty varies by tab and links to discovery/settings. Errors retain existing
rows. Offline shows cached rows and queues no read mutation; badge remains last
confirmed server value.

## Permissions and data/API

Notifications GET and read POST. Server returns only recipient records and safe
payload snapshots. Deleted/private target opens a neutral unavailable state.
Block/mute prevents future ordinary notifications; safety/account notices bypass
mute but never block policy-required notices.

## Analytics

`notifications_view`, `notification_filter`, `notification_open`,
`notifications_mark_all_read`, `notification_settings_open`; event type/entity,
not message body.

## Accessibility and SEO

Rows are links with descriptive labels; unread text is explicit; bulk status uses
polite live region. Badge is capped visually but full count accessible. Page is
noindex/no-store and excluded from sitemap.

## Acceptance criteria and tests

- Recipient isolation, all categories, grouping/timezone, unread counts.
- Read/open race, mark-all idempotency, deleted/private target.
- Block/mute and safety-notice behavior.
- Empty/loading/error/offline/pagination, keyboard, mobile, noindex/cache headers.

## Assumptions and decisions

Version 1 includes in-app notifications. Email is limited to authentication and
explicitly opted-in high-value digests; push notifications are deferred.
