# Fan Score specification

Fan Score is a recalculable participation ledger. It is separate from Hall of
Flame rank, which evaluates eligible takes within a period.

| Event                        | Points | Source            | Cap                         |
| ---------------------------- | -----: | ----------------- | --------------------------- |
| Quality take                 |     10 | Take              | Once per take               |
| Constructive reply           |      4 | Reply             | Once per reply              |
| Correct prediction           |     15 | Prediction        | Once after final resolution |
| Received insightful reaction |      2 | Reaction          | Once per active reaction    |
| Moderation penalty           |    -25 | Moderation action | Once per action             |

Every award has a unique idempotency key. Reversals are new ledger rows linked
to the original event; history is never rewritten. Refreshes and concurrent
requests cannot award an event twice. Deleted or moderated eligible content is
reversed. A removed reaction reverses its corresponding award. Scores may
decrease through explicit reversals or moderation penalties.

Predictions support pending, correct, incorrect, and void outcomes. Postponed,
cancelled, tied, or scoreless events resolve as void and award no points.
Historical actions are not automatically backfilled without an approved,
non-production dry run and explicit operator confirmation.
