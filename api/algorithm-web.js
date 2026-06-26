// api/algorithm-web.js
// Web feed algorithm for anonymous visitors
// Weights: engagement 40%, recency 25%, personalization 20%, trending 15%
// Feed mix: breaking 30%, AI articles 25%, fan takes 20%, videos 15%, trending 10%

import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { recencyScore, engagementScore, trendingScore, fromNews, fromVideos, fromAI } from './_score-utils.js';

const WEIGHTS = { engagement: 0.40, recency: 0.25, personalization: 0.20, trending: 0.15 };
const MIX     = { breaking: 0.30, ai: 0.25, takes: 0.20, video: 0.15, trending: 0.10 };
const LIMIT   = 20;

function personalizationScore(item, sport) {
  if (!sport) return 0.50;
  const hay = `${item.sport} ${item.tag} ${item.source}`.toLowerCase();
  return hay.includes(sport.toLowerCase()) ? 1.00 : 0.10;
}

function score(item, sport) {
  return (
    WEIGHTS.engagement      * engagementScore(item) +
    WEIGHTS.recency         * recencyScore(item.publishedAt) +
    WEIGHTS.personalization * personalizationScore(item, sport) +
    WEIGHTS.trending        * trendingScore(item)
  );
}

function buildFeed(scored, n) {
  const b = { breaking: [], ai: [], take: [], video: [], trending: [], other: [] };

  for (const item of scored) {
    if (item.breaking)              b.breaking.push(item);
    else if (item.type === 'ai')    b.ai.push(item);
    else if (item.type === 'take')  b.take.push(item);
    else if (item.type === 'video') b.video.push(item);
    else if (item.trending)         b.trending.push(item);
    else                            b.other.push(item);
  }

  const targets = {
    breaking: Math.round(n * MIX.breaking),
    ai:       Math.round(n * MIX.ai),
    take:     Math.round(n * MIX.takes),
    video:    Math.round(n * MIX.video),
    trending: Math.round(n * MIX.trending),
  };

  const selected = [
    ...b.breaking.slice(0, targets.breaking),
    ...b.ai.slice(0, targets.ai),
    ...b.take.slice(0, targets.take),
    ...b.video.slice(0, targets.video),
    ...b.trending.slice(0, targets.trending),
  ];

  const used = new Set(selected.map(i => i.id));
  selected.push(...scored.filter(i => !used.has(i.id)).slice(0, n - selected.length));

  return selected.sort((a, b) => b._score - a._score).slice(0, n);
}

export default async function handler(req, res) {
  const ip = getClientIP(req);
  if (!checkRateLimit(ip, 30, 60000)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const sport   = (req.query?.sport || '').toLowerCase();
  const proto   = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = `${proto}://${req.headers['host'] || 'fantakes.app'}`;

  const [newsRes, videosRes, aiRes] = await Promise.allSettled([
    fetch(`${baseUrl}/api/news?sport=${sport || 'home'}`).then(r => r.json()),
    fetch(`${baseUrl}/api/videos?sport=${sport || 'all'}`).then(r => r.json()),
    fetch(`${baseUrl}/api/articles-store`).then(r => r.json()),
  ]);

  const news   = newsRes.status   === 'fulfilled' ? (newsRes.value.articles   || []) : [];
  const videos = videosRes.status === 'fulfilled' ? (videosRes.value.videos   || []) : [];
  const ai     = aiRes.status     === 'fulfilled' && Array.isArray(aiRes.value) ? aiRes.value : [];

  const all = [
    ...fromNews(news),
    ...fromVideos(videos),
    ...fromAI(ai),
  ].map(item => ({ ...item, _score: score(item, sport) }))
   .sort((a, b) => b._score - a._score);

  const feed = buildFeed(all, LIMIT);

  return res.status(200).json({
    feed,
    meta: {
      total:       all.length,
      returned:    feed.length,
      sport:       sport || 'all',
      weights:     WEIGHTS,
      mix:         MIX,
      generatedAt: new Date().toISOString(),
    },
  });
}
