// SCOUT AGENT: Content Quality Scorer
// Scores articles for engagement potential and tracks best-performing content.
// GET  /api/agent-content → { bestPerforming, lastUpdated }
// POST /api/agent-content { articles } → { scored: [{ ...article, qualityScore }] }

import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { readMemory, patchMemory }     from './_scout-memory.js';

// Score an article based on signals available without tracking data
function scoreArticle(article) {
  let score = 0;

  const title = (article.title || '').toLowerCase();
  const age   = article.publishedAt ? (Date.now() - new Date(article.publishedAt).getTime()) / 60000 : 9999;

  // Freshness (max 30 pts)
  if (age < 30)  score += 30;
  else if (age < 60)  score += 20;
  else if (age < 180) score += 10;
  else if (age < 720) score += 5;

  // Exclusive badge (15 pts)
  if (article.badge === '🌍 Only on Sideline' || article.exclusive) score += 15;

  // Hot/trending badge (10 pts)
  if (article.badge === '🔥 Everywhere Right Now') score += 10;

  // Title engagement signals (5 pts each, max 20)
  const hotWords = ['breaking','trade','signs','fired','injured','retires','record','upset','shocking','historic','leaked','exclusive'];
  for (const w of hotWords) {
    if (title.includes(w)) { score += 5; break; }
  }

  // Has a unique/quality image (5 pts)
  if (article.image && !article.image.includes('placeholder')) score += 5;

  // Source reputation (max 10 pts)
  const premiumSources = ['the guardian','sports illustrated','sky sports','sporting news','90min'];
  const src = (article.source || '').toLowerCase();
  if (premiumSources.some(s => src.includes(s))) score += 10;

  return Math.min(100, score);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  // POST: score a submitted content array
  if (req.method === 'POST') {
    const { articles } = req.body || {};
    if (!Array.isArray(articles)) return res.status(400).json({ error: 'articles array required' });

    const scored = articles.map(a => ({ ...a, qualityScore: scoreArticle(a) }))
      .sort((a, b) => b.qualityScore - a.qualityScore);

    // Track the best performers in memory
    const best = scored.slice(0, 5).map(a => ({ title: a.title, score: a.qualityScore, source: a.source }));
    await patchMemory({ bestPerformingContent: best });

    return res.status(200).json({ scored });
  }

  // GET: return stored best-performing content
  const mem = await readMemory();
  res.setHeader('Cache-Control', 's-maxage=300');
  return res.status(200).json({
    bestPerforming: mem.bestPerformingContent || [],
    lastUpdated:    mem.lastUpdated || null,
  });
}
