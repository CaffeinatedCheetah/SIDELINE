# /ship

Ship the current changes to production.

## Steps

1. **Stage** — `git add` only the modified project files (never .env or credential files). List what's being staged.

2. **Commit** — write a concise conventional-commit message (`feat:`, `fix:`, `refactor:`, etc.) that describes WHY, not just what changed. Include the Co-Authored-By trailer.

3. **Push** — run `git push` and wait for it to complete.

4. **Verify** — run `git log origin/main..HEAD`. If it returns nothing, the push succeeded. If it returns commits, report them as "still local — push may have failed" and show the exact command to retry.

5. **Report** — one-line summary: what was shipped and whether it's confirmed live on origin.

## Rules

- Never use `git add -A` or `git add .` — stage specific files by name.
- Never skip hooks (`--no-verify`).
- If the push times out, say so explicitly and do not claim success.
- If there is nothing to commit, say so and stop.
