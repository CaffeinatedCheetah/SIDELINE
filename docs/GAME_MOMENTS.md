# Game Moments and Flash Threads

Game Moments are provider-neutral records attached to the permanent canonical
Game. Provider payloads must pass through a sport-specific adapter before they
reach the transactional materializer.

## Checkpoint 1

- `CanonicalGameMoment` contains no ESPN or MLB field names.
- ESPN MLB play IDs are scoped by event ID before persistence.
- One provider play creates one primary moment. Supplementary classifications
  such as `HOME_RUN`, `SCORE`, and `LEAD_CHANGE` live in metadata.
- Routine pitches, outs, fouls, and malformed events are ignored.
- Flash Threads are created only for the shared eligibility policy.
- PostgreSQL uniqueness protects both provider moments and one thread per
  moment.
- Ingestion is transactional and retry-safe under concurrent delivery.
- Existing Takes gain an optional Flash Thread relation and immutable game
  context fields; no competing post model is introduced.

The checkpoint fixture is deterministic and does not invent events. It models
provider plays for a game start, routine out, scoring play, go-ahead home run,
inning end, and final result.

## Release 2 runtime

The MLB lifecycle synchronization job fetches ESPN play-by-play through
`SportsMomentService`, normalizes it, and sends it to the transactional
materializer. Production does not set `SPORTS_MOMENTS_FIXTURE_PATH`; tests may
point that variable at the deterministic play-by-play fixture.

Public read endpoints expose moments and threads. Authenticated creation uses
the existing Take model and server-derived moment context. The Game Room polls
the provider-neutral endpoints every ten seconds while active, so newly
materialized Flash Threads appear without a page refresh even when realtime
delivery is unavailable. Final games archive their threads and render moments
chronologically.
