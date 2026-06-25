# SIDELINE — fantakes.app

Sports fan platform. Vercel serverless (Node.js ESM). No build step — files are deployed directly.

## Project Layout

- `index.html` — single-page app, all tabs/sections, inline JS (IIFE)
- `api/*.js` — Vercel serverless functions (ESM `export default async function handler(req, res)`)
- `api/_ratelimit.js` — shared rate-limit helper

## Content & Media Conventions

- Every article **must have a unique image**. Use deterministic selection: `pickImg(pool, title + url)` — never `title` alone (causes collisions). Post-process: if the same image URL appears on >2 articles, replace each with `pickImg(pool, article.title + article.url + article.publishedAt)`.
- Fallback image pools live in `api/news.js` (`IMG_POOLS`). Each pool must have ≥10 images so hash collisions across 8 articles are rare.
- Videos come from Dailymotion tag-based API (`embed_url` + `channel` fields). YouTube Data API is optional enhancement only (requires `YOUTUBE_API_KEY` env var).

## API & Backend

- **Always add fallbacks.** Every external API call needs a `lastGood` in-memory cache. If all sources fail, return `lastGood` rather than an error.
- Use `Promise.allSettled()` for parallel fetches — never let one failure block the rest.
- No API keys in the browser. All third-party calls go through `/api/*` serverless functions.
- Rate limiting is handled by `_ratelimit.js` — import `checkRateLimit` in every new API file.

## Git Workflow

- Stage specific files by name, not `git add -A`.
- After committing, **always run `git push` as a separate explicit step** and verify it succeeded with `git log origin/main..HEAD`. If the push fails or times out, report it clearly and show the exact command to retry.
- Never amend published commits. Create a new commit to fix mistakes.

## Code Style

- No comments unless the WHY is non-obvious.
- `index.html` JS is a single IIFE — keep all functions inside it. Export to `window.*` anything called from `onclick` attributes.
- Serverless functions use ESM (`import`/`export default`). No CommonJS.
- All user-facing fetch calls use `fetchWithTimeout(url, 10000)` with `errHTML(msg, retryCall)` on failure. Never show a loading spinner forever.
