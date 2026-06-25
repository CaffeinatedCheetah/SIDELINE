// SCOUT AGENT: Rival Monitor — runs every hour
// Fetches headlines from major rival outlets (ESPN, BR, Yahoo, CBS Sports).
// Finds stories NOT covered by any rival and badges them "🌍 Only on Sideline".
// GET /api/agent-rivals → { exclusives: [...], lastChecked }

import { checkRateLimit, getClientIP } from './_ratelimit.js';
import { readMemory, patchMemory }     from './_scout-memory.js';

const CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour

// Rival RSS feeds to monitor
const RIVAL_FEEDS = [
  'https://www.espn.com/espn/rss/news',
  'https://bleacherreport.com/articles/feed',
  'https://sports.yahoo.com/rss/',
  'https://www.cbssports.com/rss/headlines/',
];

function extractTitles(xml) {
  const titles = [];
  const re = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const t = (m[1] || m[2] || '').trim();
    if (t && t.length > 10 && !t.toLowerCase().includes('rss') && !t.toLowerCase().includes('feed')) {
      titles.push(t.toLowerCase());
    }
  }
  return titles;
}

function keywords(title) {
  const stop = new Set(['the','a','an','in','on','at','to','of','for','and','or','with','is','was','are','were','has','have','had','this','that','as','by','but','from','vs']);
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !stop.has(w));
}

function isExclusive(sidelineTitle, rivalTitles) {
  const skw = new Set(keywords(sidelineTitle));
  for (const rt of rivalTitles) {
    const rkw = keywords(rt);
    const overlap = rkw.filter(w => skw.has(w)).length;
    if (overlap >= 3) return false; // rival covers it too
  }
  return true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Rate limit exceeded' });

  const mem         = await readMemory();
  const lastChecked = mem.rivalsLastChecked || 0;
  const stale       = Date.now() - new Date(lastChecked || 0).getTime() > CHECK_INTERVAL;

  if (!stale && mem.exclusiveFinds?.length) {
    res.setHeader('Cache-Control', 's-maxage=1800');
    return res.status(200).json({ exclusives: mem.exclusiveFinds, lastChecked, fresh: false });
  }

  // Fetch rival headlines
  const rivalResults = await Promise.allSettled(
    RIVAL_FEEDS.map(url =>
      fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'Sideline-SCOUT/1.0' } })
        .then(r => r.ok ? r.text() : '')
        .catch(() => '')
    )
  );

  const rivalTitles = rivalResults.flatMap(r => r.status === 'fulfilled' ? extractTitles(r.value) : []);

  // Fetch Sideline's own articles
  let sidelineArticles = [];
  try {
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const r    = await fetch(`${base}/api/news?sport=home&limit=40`, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const d = await r.json();
      sidelineArticles = d.articles || [];
    }
  } catch { /* use cached */ }

  // Find exclusives
  const exclusives = sidelineArticles
    .filter(a => isExclusive(a.title || '', rivalTitles))
    .slice(0, 10)
    .map(a => ({ ...a, exclusive: true, badge: '🌍 Only on Sideline' }));

  await patchMemory({ exclusiveFinds: exclusives, rivalsLastChecked: new Date().toISOString() });

  res.setHeader('Cache-Control', 's-maxage=1800');
  return res.status(200).json({ exclusives, lastChecked: new Date().toISOString(), fresh: true });
}
