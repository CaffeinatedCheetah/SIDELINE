# Notification category inventory

Notification creation is deduplicated, self-notifications are suppressed, and
user-controlled preferences are enforced on the server. Moderation notices are
mandatory safety communications and therefore are not shown as an optional
setting.

| Category   | Trigger                                     | Recipient                       | Link                                        | Deduplication       | Preference   |
| ---------- | ------------------------------------------- | ------------------------------- | ------------------------------------------- | ------------------- | ------------ |
| Reply      | Comment/reply on a take, comment, or debate | Parent author or debate creator | Closest game, community, debate, or profile | Comment ID          | `REPLY`      |
| Reaction   | Reaction on a take/comment                  | Content author                  | Closest valid content context               | Reaction ID         | `REACTION`   |
| Follow     | First active follow relationship            | Followed user                   | Actor profile                               | User pair           | `FOLLOW`     |
| Debate     | Community debate opens                      | Active opted-in members         | Debate                                      | Debate/member pair  | `DEBATE`     |
| Community  | User joins a community                      | Community owner                 | Community                                   | Community/user pair | `COMMUNITY`  |
| Game       | Followed game changes important state       | Game followers                  | Game Room                                   | Game/state/user     | `GAME`       |
| Prediction | Prediction resolves                         | Predictor                       | Game Room                                   | Prediction ID       | `PREDICTION` |
| Moderation | Warning, mute, or ban                       | Affected user                   | Notifications                               | Moderation action   | Mandatory    |
| Badge      | Supported badge is first awarded            | Awarded user                    | Profile badges                              | User/badge pair     | `BADGE`      |

Deleted targets fall back to the notifications page or the closest surviving
context. Notification writes use unique keys so retries do not create duplicate
rows. Mark-one and mark-all operations scope updates to the authenticated
recipient.
