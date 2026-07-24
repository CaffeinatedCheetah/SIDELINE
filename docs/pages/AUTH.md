# Authentication and onboarding

## Purpose and users

Authenticate fans safely, preserve intended actions, and establish minimum public
identity. Users are signed-out visitors, returning users, and newly authenticated
users requiring onboarding.

## Routes, entry, exit, and access

- `/auth/sign-in`, `/auth/verify`, `/auth/error`; public and noindex.
- Entry: protected action, Navbar, expired session, or direct URL.
- Exit: validated same-origin `returnTo`, onboarding, Home, or support path.
- Authenticated onboarded users visiting sign-in redirect to `returnTo`/Home.

## Layout and exact section order

1. Minimal logo header and back link.
2. Centered auth panel: H1, concise trust copy.
3. Continue with Google button.
4. “or” separator.
5. Email form, Send secure link button, inline privacy statement.
6. Terms/community-rules links.
7. Contextual status: sent, verifying, expired, rate-limited, or error.

Onboarding after first session: welcome, handle/display name fields, favorite
teams multi-select, terms/rules checkboxes, Continue. Desktop panel max 480 px;
tablet/mobile full-width within gutters, actions stack, software keyboard does
not hide submit.

## Interactions and states

Shared Button/Forms rules apply. Provider buttons show loading independently.
Email submit always returns a neutral receipt to prevent enumeration. Focus moves
to status/error summary. Expired link offers Request new link. Disabled submit
requires valid email and required agreements. Offline disables provider/email
submission and retains email locally for retry. Auth errors never expose tokens
or provider internals. If no authentication method is configured, show an
unavailable error with support guidance rather than an empty panel.

## Permissions and data/API

Auth.js `/api/auth/*`, server session, provider account/session/token tables.
Onboarding uses `PATCH /api/v1/me/profile`. `returnTo` must be a relative same-
origin path. Suspended users reach enforcement/appeal information, not protected
participation. Recent-auth requirement applies to sensitive settings later.

## Analytics

`auth_view`, `auth_method_selected`, `auth_link_requested`, `auth_completed`,
`auth_failed`, `onboarding_started`, `onboarding_completed`; never email, token,
provider error details, or chosen handle.

## Accessibility and SEO

Visible labels, autocomplete values, password-manager compatibility, live status
without premature focus, keyboard completion, descriptive provider names. Pages
use `noindex,nofollow`; no auth query/token appears in canonical metadata.

## Acceptance criteria and tests

- Google and magic-link success, cancellation, provider failure, expired token,
  rate limit, existing/new account, suspended account.
- Safe return path accepted; external/protocol-relative redirect rejected.
- Enumeration-safe responses and secure cookie/session behavior.
- Onboarding uniqueness conflict retains values and suggests retry.
- Keyboard, screen reader, 320 px, offline, duplicate-submit tests.

## Assumptions and decisions

Google and email magic link are Version 1 methods. Passwords, phone auth, passkeys,
and account linking UI are deferred.
