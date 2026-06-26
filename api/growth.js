import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { readMemory } from './_scout-memory.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip, 30, 60000)) return res.status(429).json({ error: 'Rate limit' });

  const mem    = await readMemory();
  const subs   = globalThis.__SL_PUSH_SUBS || [];
  const takes  = globalThis.__SL_TAKES     || [];

  const proto   = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${req.headers.host}`;

  let articles = [];
  try {
    const r = await fetch(`${baseUrl}/api/articles-store`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) articles = await r.json();
  } catch {}

  const viralTakes  = takes.filter(t => t.viral);
  const totalFires  = takes.reduce((s, t) => s + (t.fires || 0), 0);
  const totalIces   = takes.reduce((s, t) => s + (t.ices  || 0), 0);
  const totalVotes  = totalFires + totalIces;

  const dashboard = {
    content: {
      articles:       articles.length,
      seoArticles:    articles.filter(a => a.seoOptimized || a.type === 'seo').length,
      socialArticles: articles.filter(a => a.type === 'social-article').length,
      takes:          takes.length,
      viralTakes:     viralTakes.length,
      breakingStories:(mem.breakingNews || []).length,
    },
    engagement: {
      totalFires,
      totalIces,
      totalVotes,
      fireRate:     totalVotes > 0 ? Math.round(totalFires / totalVotes * 100) : 50,
      viralMoments: (mem.viralMoments     || []).length,
      debatePrompts:(mem.debatePrompts    || []).length,
    },
    distribution: {
      pushSubscribers: subs.length,
      tweetsQueued:   (mem.repurposedContent || []).filter(r => !r.used).length,
      lastPublished:   mem.publisherLastRun || null,
      sentIds:        (mem.publisherSentIds  || []).length,
    },
    agents: {
      breaking:  { lastRun: mem.breakingLastChecked, stories:  (mem.breakingNews   || []).length },
      viral:     { lastRun: mem.viralLastChecked,    moments:  (mem.viralMoments   || []).length },
      seo:       { lastRun: mem.seoLastRun,          lastCount: mem.seoLastCount   || 0          },
      repurpose: { lastRun: mem.repurposeLastRun,    count:    (mem.repurposedContent || []).length },
      publisher: { lastRun: mem.publisherLastRun,    sent:     (mem.publisherSentIds  || []).length },
      worldcup:  { active:  mem.worldCup?.active,    liveGames:(mem.worldCup?.liveGames || []).length },
      pulse:     { lastNote: mem.editorNote },
    },
    siteMode:    mem.siteMode,
    insights:    mem.contentInsights || {},
    lastUpdated: new Date().toISOString(),
  };

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  return res.status(200).json(dashboard);
}
