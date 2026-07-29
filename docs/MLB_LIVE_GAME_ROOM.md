# MLB Live Game Room

The permanent `Game` record is the source of truth for the Games page,
Homepage, Game Room, follows, predictions, notifications, reputation, and
archives. UI routes must not normalize ESPN payloads independently.

## Lifecycle synchronization

Call `GET /api/jobs/sports-sync` with `Authorization: Bearer $CRON_SECRET` at
least once per minute from the approved scheduler. The job selects only MLB
games whose lifecycle interval is due:

- more than six hours away: 15 minutes
- within six hours or pregame: 5 minutes
- live or halftime: 20 seconds
- recently final: 2 minutes for 30 minutes
- postponed, cancelled, or archived final games: no polling

The provider adapter, normalizer, and transactional materializer remain behind
`SportsDataService`. Browser polling reads the canonical Game API and is a UI
freshness enhancement; it is not responsible for keeping the database current.

Vercel Hobby cron is not configured for this endpoint because its minimum
frequency is too coarse for live sports. Production must use a scheduler that
supports one-minute invocation. The adaptive job will perform the faster
20-second live refresh when called by a higher-frequency worker.

## Presence

Game Room clients send a heartbeat every 45 seconds. Presence is stored only in
Vercel KV sorted sets and expires after 90 seconds; PostgreSQL is never used for
presence heartbeats. Configure `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
Without them the UI truthfully falls back to the persisted game-follower count
instead of inventing an active-user number.
