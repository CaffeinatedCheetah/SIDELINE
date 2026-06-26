# Sideline — TODO

## Environment Variables (Vercel Dashboard → Settings → Environment Variables)
- [ ] `ANTHROPIC_API_KEY` — required by agent-social, agent-breaking, agent-hunter, agent-worldcup, agent-pulse, agent-social-manual
- [ ] `RAPIDAPI_KEY` — optional; used by agent-social for Twitter154 API (falls back to Nitter RSS without it)
- [ ] `CRON_SECRET` — recommended; protects cron endpoints from unauthorized manual triggers
- [ ] `SCOUT_SECRET_KEY` — required for agent-memory POST writes
- [ ] `KV_REST_API_URL` + `KV_REST_API_TOKEN` — optional; enables persistent SCOUT memory via Vercel KV (without these, memory resets on cold start)

## Cron Agents (all now wired in vercel.json)
- [x] agent-social — every 15 min
- [x] agent-breaking — every 5 min
- [x] agent-hunter — every 5 min
- [x] agent-worldcup — every 5 min
- [x] agent-pulse — every 30 min
- [x] agent-rivals — every 60 min

## Verify in Vercel Dashboard
- [ ] Check Functions → Logs to confirm cron agents are firing without errors
- [ ] Confirm ANTHROPIC_API_KEY is set and valid
- [ ] Add RAPIDAPI_KEY if you want live Twitter data (vs Nitter RSS fallback)

## Storage Upgrades
- [ ] Upgrade articles-store (/tmp) to Vercel KV for persistent published articles across cold starts
- [ ] Upgrade agent-social processed-IDs set to KV to prevent re-processing after cold start

## Feed
- [x] algorithm-web wired into index.html home feed
- [ ] Wire algorithm-app into mobile app client when ready
- [ ] Add GET endpoint for fan takes so algorithm can include them in feed scoring
