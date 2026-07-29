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

Game Room UI, public APIs, provider fetching, realtime delivery, and archive
presentation intentionally remain outside checkpoint 1.
