// SCOUT AGENT 2: Breaking News Detector — runs every 5 minutes
// Compares fresh headlines against stored ones to flag truly breaking stories.
// GET /api/agent-breaking → { breaking: [...], lastChecked }

import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { readMemory, patchMemory }     from './_scout-memory.js';
import { callClaude, parseJSON }       from './_claude-api.js';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

const BREAKING_SYSTEM = `You are SCOUT, Sideline's AI breaking-news detector.
You have a nose for what matters RIGHT NOW to sports fans.
You identify genuinely breaking, urgent stories — not routine recaps.`;

async function detectBreaking(freshArticles, storedHeadlines) {
  const storedSet = new Set(storedHeadlines.map(h => h.toLowerCase()));
  const newOnes   = freshArticles.filter(a => {
    const title = (a.title || '').toLowerCase();
    return !storedSet.has(title);
  });

  if (!newOnes.length || !process.env.ANTHROPIC_API_KEY) return [];

  const list = newOnes.slice(0, 15).map((a, i) => `${i+1}. ${a.title}`).join('\n');
  const prompt = `You are SCOUT. Scan these new sports headlines and identify BREAKING stories only.
Breaking = injury announcements, trades, firings, immediate game events, records broken NOW.
NOT breaking = previews, analysis, opinion.

HEADLINES:
${list}

Return ONLY valid JSON array of breaking items (empty array if none):
[{"title":"...","urgency":1-10,"sport":"nfl|nba|mlb|nhl|soccer|ufc|f1|general","summary":"1 sentence max"}]
Max 3 items. If nothing is truly breaking, return [].`;

  try {
    const text    = await callClaude({ prompt, system: BREAKING_SYSTEM, maxTokens: 512 });
    const results = parseJSON(text) || [];
    return Array.isArray(results)
      ? results.filter(r => r.urgency >= 7).slice(0, 3).map(r => ({ ...r, detectedAt: new Date().toISOString() }))
      : [];
  } catch { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const mem = await readMemory();

  const lastChecked = mem.breakingLastChecked || 0;
  const stale       = Date.now() - new Date(lastChecked).getTime() > CHECK_INTERVAL;

  if (stale) {
    try {
      const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
      const r = await fetch(`${base}/api/news?sport=home&limit=30`, { signal: AbortSignal.timeout(8000) });
      if (r.ok) {
        const d            = await r.json();
        const fresh        = d.articles || [];
        const stored       = (mem.breakingNews || []).map(b => b.title);
        const newBreaking  = await detectBreaking(fresh, stored);

        // Merge: keep old breaking news for 2h, add new
        const now    = Date.now();
        const TWO_HR = 2 * 60 * 60 * 1000;
        const kept   = (mem.breakingNews || []).filter(b => now - new Date(b.detectedAt).getTime() < TWO_HR);
        const merged = [...newBreaking, ...kept].slice(0, 5);

        await patchMemory({ breakingNews: merged, breakingLastChecked: new Date().toISOString() });

        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ breaking: merged, lastChecked: new Date().toISOString(), fresh: true });
      }
    } catch { /* fall through to cached */ }
  }

  res.setHeader('Cache-Control', 's-maxage=60');
  return res.status(200).json({
    breaking:    mem.breakingNews || [],
    lastChecked: mem.breakingLastChecked || null,
    fresh:       false,
  });
}
