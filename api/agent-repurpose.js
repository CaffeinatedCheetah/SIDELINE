import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { callClaude, parseJSON } from './_claude-api.js';
import { patchMemory, readMemory } from './_scout-memory.js';

const REPURPOSE_INTERVAL = 60 * 60 * 1000;

const SYSTEM = `You are a social media strategist for Sideline (fantakes.app).
Repurpose sports content into high-engagement platform-native posts.
Keep opinions sharp. Drive traffic back to fantakes.app.`;

async function repurpose(item) {
  const text = await callClaude({
    prompt: `Repurpose this ${item.type} for social media:

"${String(item.text || '').slice(0, 400)}"
Sport: ${item.sport || 'Sports'}

Return ONLY JSON:
{
  "twitterThread": ["tweet1 (max 230 chars, end with 1/3)","tweet2 (2/3)","tweet3 — fantakes.app (3/3)"],
  "instagram": "caption here (max 220 chars)\n\n#sports #fansonly #fantakes + 7 more relevant hashtags",
  "threads": "conversational 400-char post asking fans a spicy question, end with fantakes.app",
  "blogIntro": "120-word punchy first paragraph for a blog article on this topic, SEO-friendly"
}`,
    system: SYSTEM,
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 900,
  });
  return parseJSON(text);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip, 5, 60000)) return res.status(429).json({ error: 'Rate limit' });

  const mem     = await readMemory();
  const lastRun = mem.repurposeLastRun || 0;
  const stale   = Date.now() - new Date(lastRun || 0).getTime() > REPURPOSE_INTERVAL;

  if (!stale && !req.query.force) {
    res.setHeader('Cache-Control', 's-maxage=600');
    return res.status(200).json({ repurposed: mem.repurposedContent || [], fresh: false });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ repurposed: [], message: 'ANTHROPIC_API_KEY not set' });
  }

  const proto   = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${req.headers.host}`;

  let articles = [];
  try {
    const r = await fetch(`${baseUrl}/api/articles-store`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) articles = await r.json();
  } catch {}

  const candidates = [
    ...articles.slice(0, 3).map(a => ({
      id:   a.id,
      type: 'article',
      text: `${a.headline}. ${a.subheadline || ''}`.trim(),
      sport: a.sport || 'Sports',
    })),
    ...(mem.viralMoments || []).filter(m => m.isWorthy).slice(0, 2).map(m => ({
      id:   m.id,
      type: 'viral take',
      text: m.title,
      sport: (m.subreddit || 'sports').toUpperCase(),
    })),
  ];

  const repurposed = [];
  for (const item of candidates.slice(0, 4)) {
    try {
      const result = await repurpose(item);
      if (result) {
        repurposed.push({
          id:        `rep-${item.id}-${Date.now()}`,
          source:    item,
          ...result,
          createdAt: new Date().toISOString(),
          used:      false,
        });
      }
    } catch (err) {
      // skip failed items silently
    }
    await new Promise(r => setTimeout(r, 900));
  }

  // Content insight: track which sport drives the most viral moments
  const sportCounts = {};
  for (const m of mem.viralMoments || []) {
    const s = m.subreddit || 'other';
    sportCounts[s] = (sportCounts[s] || 0) + 1;
  }
  const topSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'sports';

  await patchMemory({
    repurposedContent: repurposed,
    repurposeLastRun:  new Date().toISOString(),
    contentInsights: {
      topSport,
      totalRepurposed: repurposed.length,
      lastAnalyzed:    new Date().toISOString(),
    },
  });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ repurposed, insights: { topSport }, fresh: true });
}
