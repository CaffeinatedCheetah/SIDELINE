# Earnable badge inventory

Only badges backed by reliable FanTakes actions are visible on profiles.

| Badge             | Rule                                       | Repeatable | Trigger               | Revocation                                                              | Backfill                             |
| ----------------- | ------------------------------------------ | ---------- | --------------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| First Take        | Publish the first active take              | No         | Take creation         | Retained as historical achievement unless abuse invalidates the account | Approved non-production command only |
| Perfect Read      | Resolve one eligible prediction as correct | No         | Prediction resolution | Retained; void/cancelled games never award it                           | Approved non-production command only |
| Community Builder | Contribute constructively to a community   | No         | Not enabled           | Not applicable                                                          | Not applicable                       |

`Community Builder` remains defined for forward compatibility but is not
displayed unless awarded, and no award path exists until its objective
eligibility rule is approved. Award writes use the unique user/badge constraint;
badge notifications use a separate unique deduplication key.
