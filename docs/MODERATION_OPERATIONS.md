# Moderation role operations

Closed-alpha role assignment remains a CLI-only administrator operation.

Set `MODERATION_OPERATOR_EMAIL` to an existing administrator, then run:

```bash
npm run role:manage -- target@example.com MODERATOR "Closed-alpha moderator" --confirm
```

Reversal uses the same audited command with `USER`:

```bash
npm run role:manage -- target@example.com USER "Moderator access revoked" --confirm
```

The command validates the operator and target, prevents self-escalation, requires
an explicit reason and confirmation, updates the role transactionally, and
records the previous/new roles in operational history. UI visibility is never
treated as authorization.
