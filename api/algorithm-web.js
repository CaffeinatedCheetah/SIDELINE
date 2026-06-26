// api/algorithm-web.js
// Web feed algorithm for anonymous visitors
// Weights: engagement 40%, recency 25%, personalization 20%, trending 15%
// Feed mix: breaking 30%, AI articles 25%, fan takes 20%, videos 15%, trending 10%

import { checkRateLimit, getClientIP } from './_ratelimit.js';

const WEIGHTS = { engagement: 0.40, recency: 0.25, personalization: 0.20, trending: 0.15 };
const MIX     = { breaking: 0.30, ai: 0.25, takes: 0.20, video: 0.15, trending: 0.10 };
const LIMIT   = 20;

// ── Scoring helpers ────────────────────────────────────────────────────────

function recencyScore(publishedAt) {
  const h = (Date.now() - new Date(publishedAt || 0).getTime()) / 3_600_000;
  if (h < 1)  return 1.0;
  if (h < 6)  return 0.80;
  if (h < 24) return 0.60;
  if (h < 72) return 0.30;
  return 0.10;
}

function engagementScore(item) {
  if (item.breaking)         return 1.00;
  if (item.trending)         return 0.80;
  if (item.exclusive)        return 0.65;
  if (item.type === 'video') return 0.65;
  if (item.type === 'ai')    return 0.55;
  return 0.40;
}

function trendingScore(item) {
  if (item.breaking || item.tag === 'Breaking')   return 1.00;
  if (item.trending  || item.tag === 'Hot Take')  return 0.75;
  return 0.20;
}

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

// ── Normalizers ────────────────────────────────────────────────────────────

function fromNews(articles) {
  return articles.map(a => ({
    id:          a.url || a.title,
    type:        a.breaking ? 'breaking' : (a.trending ? 'trending' : 'news'),
    title:       a.title,
    summary:     '',
    image:       a.image || a.urlToImage || '',
    url:         a.url || '#',
    sport:       a.sport || '',
    source:      typeof a.source === 'object' ? a.source.name : (a.source || 'News'),
    publishedAt: a.publishedAt,
    breaking:    !!a.breaking,
    trending:    !!a.trending,
    exclusive:   !!a.exclusive,
    tag:         a.breaking ? 'Breaking' : '',
  }));
}

function fromVideos(videos) {
  return videos.map(v => ({
    id:          v.id || v.url,
    type:        'video',
    title:       v.title,
    summary:     '',
    image:       v.thumb || '',
    url:         v.url || `https://www.youtube.com/watch?v=${v.id}`,
    sport:       v.tag || '',
    source:      v.channel || 'Video',
    publishedAt: v.published || v.publishedAt || new Date().toISOString(),
    tag:         'Video',
  }));
}

function fromAI(articles) {
  return articles.map(a => ({
    id:          a.id,
    type:        'ai',
    title:       a.headline,
    summary:     a.subheadline || '',
    image:       a.thumbnail || '',
    url:         a.sourceUrl || '#',
    sport:       a.sport || '',
    source:      `⚡ Sideline AI · @${a.sourceUsername || ''}`,
    publishedAt: a.publishedAt,
    embed:       a.embed || null,
    tag:         a.tag || '',
    trending:    a.tag === 'Breaking' || a.tag === 'Hot Take',
    breaking:    a.tag === 'Breaking',
    exclusive:   false,
  }));
}

// ── Feed builder ───────────────────────────────────────────────────────────

function buildFeed(scored, n) {
  const b = { breaking: [], ai: [], take: [], video: [], trending: [], other: [] };

  for (const item of scored) {
    if (item.breaking)         b.breaking.push(item);
    else if (item.type === 'ai')    b.ai.push(item);
    else if (item.type === 'take')  b.take.push(item);
    else if (item.type === 'video') b.video.push(item);
    else if (item.trending)    b.trending.push(item);
    else                       b.other.push(item);
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

// ── Handler ────────────────────────────────────────────────────────────────

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
