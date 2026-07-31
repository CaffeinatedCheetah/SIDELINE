# SIDELINE AI architecture

## Purpose and non-goals

SIDELINE AI turns bounded, existing SIDELINE records into optional editorial
artifacts. Release 3.1A proves the platform with completed-game recaps. It is
not a chatbot, sports-data provider, search engine, moderation authority,
prediction system, or autonomous publisher.

## Grounding and trust model

The SIDELINE database is the only source of truth. A deterministic retriever
separates official game facts from public community context. User-authored
text is untrusted data and cannot change instructions. The model organizes
evidence; deterministic application code decides eligibility, authorization,
cache identity, persistence, and whether output is safe to display.

```text
Game and community data
        ↓
Deterministic retriever
        ↓
Normalized context bundle
        ↓
Versioned prompt builder
        ↓
OpenAI Responses API (store: false, no tools)
        ↓
Strict Zod structured-output validation
        ↓
Deterministic grounding validation
        ↓
Cached AiArtifact
        ↓
Server-rendered Game Room UI
```

## Data retrieval

`lib/ai/retrieval/game-recap.ts` performs one bounded Prisma read. It includes
the game, teams, league/sport, at most 12 verified moments, five Flash Threads
with four active Takes each, eight active game Takes, and four active/closed
Debates. Deleted and moderated Takes are excluded. Emails, authentication
records, private settings, sessions, and OAuth data are never selected.

The normalized context uses `contextVersion: "1"` and includes stable source
IDs in a source manifest. Official facts and untrusted community data remain
separate.

## Prompts and structured outputs

Prompts live in `lib/ai/prompts/` and expose task, prompt, schema, and context
versions. `game-recap-v1` instructs the model to use only supplied evidence,
ignore instructions embedded in community text, avoid quotations and
unsupported claims, and admit missing evidence.

`gameRecapSchema` is strict and versioned. It bounds every string and array,
rejects unknown fields and HTML, and permits only supplied UUID moment
references. Free-form Markdown is never parsed as application state.

## Provider abstraction and models

`AiProvider` is the application boundary. `OpenAiProvider` is server-only and
is the sole module using the official SDK. It uses the Responses API,
structured output parsing, `store: false`, no provider tools, an abort-capable
request, a 30-second default timeout, and at most one retry for transient
timeouts, rate limits, and 5xx failures.

Models are centralized:

- routine recap: `gpt-5.4-mini`
- complex/future fallback: `gpt-5.4`

There is no silent model fallback. The actual model is stored per artifact.

## Cache, invalidation, and lifecycle

A SHA-256 context hash uses canonical key ordering and includes official facts,
selected source content, and all prompt/context/schema versions. The database
unique constraint on task, entity, entity ID, and hash is the final duplicate
guard. A READY match is returned cache-first.

Official changes always invalidate the artifact. Community context may refresh
during a concrete two-hour postgame window. After that window, engagement
counts and individual community Takes are excluded from the hash so low-value
late reactions do not regenerate a durable recap. An administrator may
explicitly force regeneration.

`AiArtifact.status` is the durable job lifecycle:

`PENDING → GENERATING → READY`

or `INSUFFICIENT_DATA`, `FAILED`, and `STALE`. Atomic `updateMany` acquisition
allows only one worker to claim an artifact. The implementation does not use an
in-memory queue, `setTimeout`, or unawaited serverless work.

## Job execution, retry, and failure

Generation is one awaited server service callable by an admin-only route and
the existing bearer-protected Vercel cron convention. The cron processes at
most three recent final games per invocation. Anonymous and ordinary users
cannot trigger generation. Authentication, policy, schema, and grounding
failures are not retried. Invalid output is never displayed.

## Cost, rate, and abuse controls

Generation requires three dark-by-default flags and a server-only API key.
Inputs and outputs are bounded; admin generation is rate limited to five
requests per hour. A database-backed daily generation limit (25 by default)
and optional estimated-cost ceiling (USD 5 by default) stop work safely.
Because model prices change, this release stores provider token usage and only
uses cost totals when a trusted server-side pricing configuration has produced
an estimate. It does not trust client cost data.

## Privacy and retention

OpenAI requests use `store: false`. SIDELINE stores the validated artifact,
source manifest, versions, hashes, sanitized error code/message, provider
request ID, token counts, and latency. It does not store API keys, raw prompts,
authorization data, chain-of-thought, or complete private context. Public,
active content is subject to SIDELINE's normal local retention rules.

## Safety and prompt injection

Instructions and JSON data are structurally separated. User content is labeled
`untrustedContext`; no web, file, shell, code, or function tools are enabled.
Context size is bounded. Strict schema validation runs first, followed by
source-ID, score-conflict, HTML, and unsupported-community-summary checks.
Malformed or adversarial content cannot authorize actions or bypass those
checks.

## Evaluation

Default tests use deterministic fixtures and fake providers—never paid calls.
They cover schema validity, canonical hashing, moment references, score
consistency, community isolation, sparse evidence, cache behavior, concurrency,
and provider errors. An optional small live smoke test is gated by
`RUN_OPENAI_LIVE_TESTS=true`; it incurs API cost and is excluded by default.

## Feedback and observability

Authenticated users may keep one current HELPFUL or NOT_HELPFUL vote per
artifact. Feedback informs later offline evaluation only; it does not train a
model or change prompts in this release.

Structured logs contain task, artifact/game IDs, cache state, model and
versions, latency, token usage, result, safe error code, and provider request
ID. They exclude secrets, raw prompts, and complete community context.
`/admin/ai` exposes sanitized counts, usage, latency, recent statuses, prompt
versions, failure codes, and feedback totals to existing ADMIN users.

## Feature flags, rollback, and outages

- `OPENAI_AI_ENABLED=false`
- `OPENAI_GAME_RECAPS_ENABLED=false`
- `OPENAI_AI_ADMIN_GENERATION_ENABLED=false`
- `OPENAI_API_KEY` is optional

The schema can deploy while all flags remain dark. A missing key or provider
outage never breaks non-AI pages. Existing READY artifacts remain readable
when the recap display flag is enabled even if generation is unavailable;
turning that flag off also prevents table reads during a schema-first rollout.
Generation can be disabled without deleting data. Environment flags are
read-only in the admin dashboard because SIDELINE has no runtime flag service.

## Future platform work

The same provider/retrieval/artifact boundary can later support Flash Thread
summaries, Debate summaries, personalized briefings, and natural-language
search. Each requires its own versioned retriever, prompt, strict schema,
evaluation set, authorization rules, and feature flag.

## Deterministic/model boundary

Application code owns eligibility, completion state, source selection,
moderation/privacy filtering, prompt version, token/output ceilings, budget,
authorization, caching, atomic acquisition, schema checks, grounding checks,
storage, feedback, and rendering state. The model owns only concise wording
and evidence organization inside the supplied schema.
