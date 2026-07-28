# Sports data domain service

All FanTakes product surfaces consume `SportsDataService`. Pages and jobs do not
call a provider directly.

`SportsDataService → provider adapter → cache → normalizer → materializer →
time service → game-state consumers`

Provider events normalize into the neutral `Contest`, `Participant`, and
`ContestState` model. Persistence records payload, schema, and adapter versions.
The provider event key is unique; materialization uses a serializable
transaction and bounded retries.

## Supported head-to-head leagues

| League | Provider ID | Schedule | Live | Final | Logos | Game Room | Refresh | Limitation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NFL | `football/nfl` | Yes | Yes | Yes | Usually | Yes | 15s live / 5m idle | Off-season schedules may be empty |
| NBA | `basketball/nba` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Clock detail varies |
| MLB | `baseball/mlb` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Inning-half detail is provider text |
| NHL | `hockey/nhl` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Intermission detail varies |
| WNBA | `basketball/wnba` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Off-season schedules may be empty |
| EPL | `soccer/eng.1` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Match minute may be absent |
| MLS | `soccer/usa.1` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Match minute may be absent |
| La Liga | `soccer/esp.1` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Match minute may be absent |
| Bundesliga | `soccer/ger.1` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Match minute may be absent |
| Serie A | `soccer/ita.1` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Match minute may be absent |
| Ligue 1 | `soccer/fra.1` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Match minute may be absent |
| Champions League | `soccer/uefa.champions` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Competition rounds vary |
| World Cup | `soccer/fifa.world` | Yes | Yes | Yes | Usually | Yes | 15s / 5m | Empty outside tournament windows |

F1 remains excluded from the head-to-head model. It requires an event/session,
position, and lap model and must not be represented as a fake matchup.

## Observability

The service records provider latency, cache hits/misses, normalization and
materialization failures, duplicate prevention, refresh duration, stale contest
count, and synchronized contests per league. The protected release dashboard
shows current-process metrics and persisted operational job history.
