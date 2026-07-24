# API specification

## Existing behavior

No API implementation exists.

## Required architecture

Next.js Route Handlers expose `/api/v1`. Public page reads should call shared
server services directly rather than loop back through HTTP. Browser mutations
use the same service layer through Route Handlers. Inputs and outputs are Zod
validated and JSON encoded as UTF-8.

## Conventions

- JSON keys use `camelCase`; database naming stays internal.
- Timestamps use RFC 3339 UTC strings.
- IDs are opaque strings.
- Collections return `{ items, nextCursor }`; cursors are opaque and signed.
- Success mutation returns the canonical resource and optional `meta`.
- `Idempotency-Key` is required for take, prediction, report, and moderation
  creation and retained for 24 hours per actor/route.
- Unsupported methods return 405 with `Allow`.

## Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the highlighted fields.",
    "fieldErrors": {"body": ["Enter between 1 and 1000 characters."]},
    "requestId": "opaque-id"
  }
}
```

Codes: `AUTH_REQUIRED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`CONFLICT` (409), `VALIDATION_ERROR` (422), `RATE_LIMITED` (429),
`UPSTREAM_UNAVAILABLE` (503), and `INTERNAL_ERROR` (500). Messages are safe and
do not reveal existence of private resources, credentials, SQL, or stack traces.

## Required endpoints

### Discovery and identity

- `GET /api/v1/games?status&league&date&cursor`
- `GET /api/v1/games/{id}`
- `GET /api/v1/debates?status&communityId&gameId&cursor`
- `POST /api/v1/debates`
- `GET /api/v1/debates/{id}`
- `GET /api/v1/communities?query&cursor`
- `GET /api/v1/communities/{slug}`
- `GET /api/v1/users/{handle}`
- `GET /api/v1/search?q&type&cursor`
- `GET /api/v1/hall-of-flame?period&category`

### Takes and reactions

- `GET /api/v1/takes?gameId|debateId|communityId|authorId&cursor&sort`
- `POST /api/v1/takes`
- `PATCH /api/v1/takes/{id}` for author while editable
- `DELETE /api/v1/takes/{id}` creates author tombstone where required
- `PUT /api/v1/takes/{id}/reactions/{kind}`
- `DELETE /api/v1/takes/{id}/reactions/{kind}`

### Predictions and participation

- `GET /api/v1/games/{id}/predictions`
- `PUT /api/v1/predictions/{id}/entry`
- `PUT|DELETE /api/v1/games/{id}/follow`
- `POST|DELETE /api/v1/communities/{slug}/membership`
- `PUT /api/v1/debates/{id}/position`
- `PUT|DELETE /api/v1/users/{handle}/follow`

### Private user APIs

- `GET|PATCH /api/v1/me/profile`
- `GET|PATCH /api/v1/me/settings`
- `GET /api/v1/me/arena`
- `GET /api/v1/me/notifications?cursor&unread`
- `POST /api/v1/me/notifications/read`
- `POST|DELETE /api/v1/me/blocks/{userId}`
- `POST|DELETE /api/v1/me/mutes/{targetType}/{targetId}`
- `POST /api/v1/me/account-deletion`

### Safety

- `POST /api/v1/reports`
- `GET /api/v1/moderation/reports` for scoped moderators
- `POST /api/v1/moderation/reports/{id}/decision`

## Authentication and authorization

- Auth.js owns `/api/auth/*`; it is not duplicated under `/api/v1`.
- Mutations require an authenticated active user unless specifically public.
- Route handlers obtain actor identity only from the server session.
- Authorization is evaluated per resource in the service layer.
- Moderator operations require platform or community scope.
- Safe `returnTo` values must be same-origin relative paths.

## Validation and business rules

- Take body: trimmed for emptiness but stored exactly except normalized line
  endings; 1–1,000 Unicode characters; URL previewing deferred.
- Prediction entry: option must belong to prediction and server time precede lock.
- Search: query 2–100 characters; control characters rejected.
- Report: allowed target and reason; detail 0–1,000 characters.
- Profile: handle 3–24 ASCII letters/digits/underscore; display name 1–50;
  bio 0–280 Unicode characters.
- Server enforces block, suspension, membership, content status, and rate limits.

## Caching and live updates

- Public directory GETs may use short CDN caching with tag invalidation.
- Game detail polling returns ETag/version and supports `If-None-Match`.
- Private/user-specific responses use `private, no-store`.
- Mutations and auth responses are never publicly cached.
- Version 1 polls live games every 15 seconds while visible, 60 seconds when
  backgrounded, and stops after final state. Upstream failure keeps last known
  score with a visible stale timestamp.

## Rate limits

Per account plus IP fallback: auth 5/15 minutes, takes 20/minute, reactions
120/minute, predictions 30/minute, search 60/minute, reports 10/hour. Return
429 with `Retry-After`. Limits are defaults and may be tightened operationally
without changing response semantics.

## Analytics, logging, and privacy

Every request receives a request ID. Log route, status, duration, actor ID when
permitted, and safe entity IDs. Never log tokens, email magic links, authored
body text, report detail, cookies, or search terms. Analytics events follow
`USER_FLOWS.md` and require consent where law or policy requires it.

## Security requirements

- Zod validation, parameterized ORM operations, HTML escaping, safe URL parsing.
- Origin/CSRF checks on cookie-authenticated mutations.
- Secure, HttpOnly, SameSite cookies; session rotation and revocation.
- CSP, HSTS, `nosniff`, referrer policy, and frame restrictions.
- Constant-shape auth recovery responses to reduce account enumeration.
- Uploads are deferred; avatar URLs must originate from an approved image path.

## Testing and observability

Contract tests cover every status/error shape. Integration tests use a real test
database and permission matrix. Load tests cover game polling and take creation
before release. Health endpoints distinguish process liveness from database and
provider readiness without exposing secrets.

## Assumptions and decisions

- REST Route Handlers are simpler than GraphQL for Version 1.
- No public third-party API or webhooks are promised.
- Provider ingestion runs through an internal adapter/job, not caller endpoints.
