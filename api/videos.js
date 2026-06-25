import { checkRateLimit, getClientIP } from './_ratelimit.js';

// In-memory cache: sport -> { videos, ts, source }
const videoCache = new Map();
const lastGood   = new Map();
const CACHE_TTL  = 2 * 60 * 60 * 1000; // 2 hours

// ── YouTube Data API ───────────────────────────────────────────────────────
const YT_CHANNELS = {
  all:      ['UCDVYQ4Zhbm3S2dlz7P1GBDg','UCEjOSbbaOfgnfRODEEMYlCw','UCoLrcjPV5PbUrUyXq5mjc_A','UCqZQlzSHbVJrwrn5XvzrzcA','UCznv__14nznPLH1T2YMDbhA','UCvgfXK4nTYKudb0rFR6noSQ','UCB_qr75-ydFVKSF9Dmo6izg','UCB-3oiAkRKvMQbVQkjD_f5A','UCW-QMcKMSMBHlTj0SVFdNrQ','UCpcTrCXblq78Gn28FGMocqQ'],
  american: ['UCDVYQ4Zhbm3S2dlz7P1GBDg','UCEjOSbbaOfgnfRODEEMYlCw','UCoLrcjPV5PbUrUyXq5mjc_A','UCB-3oiAkRKvMQbVQkjD_f5A'],
  soccer:   ['UCqZQlzSHbVJrwrn5XvzrzcA','UCW-QMcKMSMBHlTj0SVFdNrQ','UCpcTrCXblq78Gn28FGMocqQ','UCsb5wjy_TfzfUMDFECDaADQ','UC8ZpZgeEVHCMn9PfnOyEhAA'],
  rugby:    ['UCznv__14nznPLH1T2YMDbhA'],
  combat:   ['UCvgfXK4nTYKudb0rFR6noSQ'],
  racing:   ['UCB_qr75-ydFVKSF9Dmo6izg'],
};

const YT_TAGS = {
  'UCDVYQ4Zhbm3S2dlz7P1GBDg':'NFL','UCEjOSbbaOfgnfRODEEMYlCw':'NBA','UCoLrcjPV5PbUrUyXq5mjc_A':'MLB',
  'UCqZQlzSHbVJrwrn5XvzrzcA':'EPL','UCznv__14nznPLH1T2YMDbhA':'Rugby','UCvgfXK4nTYKudb0rFR6noSQ':'UFC',
  'UCB_qr75-ydFVKSF9Dmo6izg':'F1','UCB-3oiAkRKvMQbVQkjD_f5A':'NHL','UCW-QMcKMSMBHlTj0SVFdNrQ':'MLS',
  'UCpcTrCXblq78Gn28FGMocqQ':'UCL','UCsb5wjy_TfzfUMDFECDaADQ':'La Liga','UC8ZpZgeEVHCMn9PfnOyEhAA':'Soccer',
};

async function fetchYouTubeAPI(sport, key) {
  const channels = YT_CHANNELS[sport] || YT_CHANNELS.all;
  const results = await Promise.allSettled(channels.map(async id => {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${id}&maxResults=4&order=date&type=video&key=${key}`
    );
    if (!r.ok) return [];
    const d = await r.json();
    if (d.error) return [];
    return (d.items || []).filter(i => i.id?.videoId).map(i => ({
      id:        i.id.videoId,
      tag:       YT_TAGS[id] || 'Sports',
      title:     i.snippet.title,
      thumb:     i.snippet.thumbnails.medium?.url || i.snippet.thumbnails.default?.url,
      channel:   i.snippet.channelTitle,
      published: i.snippet.publishedAt,
      source:    'YouTube',
    }));
  }));
  return results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
}

// ── Dailymotion tag-based (primary source) ────────────────────────────────
const DM_TAGS = {
  all:      ['nfl','nba','soccer','mlb','ufc'],
  american: ['nfl','nba','mlb','nhl'],
  soccer:   ['soccer','football','premier-league'],
  rugby:    ['rugby'],
  combat:   ['ufc','mma','boxing'],
  racing:   ['formula1','f1'],
};

async function fetchDailymotion(sport) {
  const tags = DM_TAGS[sport] || DM_TAGS.all;
  const results = await Promise.allSettled(tags.map(async tag => {
    try {
      const r = await fetch(
        `https://api.dailymotion.com/videos?fields=id,title,thumbnail_url,embed_url,created_time,channel&tags=${tag}&limit=5`
      );
      if (!r.ok) return [];
      const d = await r.json();
      return (d.list || []).map(v => ({
        id:        v.id,
        tag:       tag.toUpperCase().replace('PREMIER-LEAGUE','EPL').replace('FORMULA1','F1'),
        title:     v.title,
        thumb:     v.thumbnail_url || '',
        channel:   v.channel || 'Dailymotion',
        published: new Date(v.created_time * 1000).toISOString(),
        source:    'Dailymotion',
        embedUrl:  (v.embed_url || `https://www.dailymotion.com/embed/video/${v.id}`) + '?autoplay=1',
      }));
    } catch { return []; }
  }));
  return results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
}

// ── Deduplication ──────────────────────────────────────────────────────────
const STOP = new Set(['the','a','an','is','are','was','were','have','has','do','did','in','on','at','by','for','with','and','or','to','of','vs','vs.','after','highlights','official']);

function keywords(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}

function dedupe(videos) {
  const seenIds = new Set();
  const out = [];
  for (const v of videos) {
    if (seenIds.has(v.id)) continue;
    seenIds.add(v.id);
    // Title dedup: skip if 4+ shared keywords with existing entry
    const kw = new Set(keywords(v.title || ''));
    const isDup = out.some(u => keywords(u.title || '').filter(w => kw.has(w)).length >= 4);
    if (!isDup) out.push(v);
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded.', videos: [] });
  }

  const sport = req.query.sport || 'all';

  // 2-hour in-memory cache
  const cached = videoCache.get(sport);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.setHeader('X-Video-Source', `cache:${cached.source}`);
    return res.status(200).json({ videos: cached.videos, source: cached.source });
  }

  const YT_KEY = process.env.YOUTUBE_API_KEY;
  let videos = [];
  let source  = 'none';

  // ── LAYER 2: call ALL available sources simultaneously ─────────────────
  const [ytResult, dmResult] = await Promise.allSettled([
    YT_KEY ? fetchYouTubeAPI(sport, YT_KEY) : Promise.resolve([]),
    fetchDailymotion(sport),
  ]);

  const ytVideos = ytResult.status === 'fulfilled' ? ytResult.value : [];
  const dmVideos = dmResult.status === 'fulfilled' ? dmResult.value : [];

  // Prefer YouTube API if it returned anything; otherwise Dailymotion
  if (ytVideos.length) {
    videos = ytVideos;
    source  = 'youtube-api';
  } else if (dmVideos.length) {
    videos = dmVideos;
    source  = 'dailymotion';
  }

  // Deduplicate and sort newest first
  videos = dedupe(videos).sort((a, b) => new Date(b.published) - new Date(a.published));

  // Cache the result (warm instances skip all API calls for 2 hours)
  if (videos.length) {
    const payload = { videos, ts: Date.now(), source };
    videoCache.set(sport, payload);
    lastGood.set(sport, payload);
  }

  // Last-good fallback if both sources returned nothing
  if (!videos.length) {
    const fallback = lastGood.get(sport);
    if (fallback) {
      res.setHeader('Cache-Control', 's-maxage=60');
      res.setHeader('X-Video-Source', 'fallback');
      return res.status(200).json({ videos: fallback.videos, source: 'fallback' });
    }
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
  res.setHeader('X-Video-Source', source);
  return res.status(200).json({ videos, source });
}
