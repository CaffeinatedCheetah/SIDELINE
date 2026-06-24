import { checkRateLimit, getClientIP } from './_ratelimit.js';

// In-memory cache: sport -> { videos, ts, source }
const videoCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

// RSS fallback feeds — no API key, no quota
const RSS_FEEDS = [
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCB7DYLhKzIwZ0qG2FjEhpZA', tag: 'NFL' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCWJ2lWNubArHWmf3FIHbfcQ', tag: 'NBA' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCiWLfSweyRNmLpgEHekhoAg', tag: 'ESPN' },
  { url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCoLrcjPV5PbUrUyXq5mjc_A', tag: 'MLB' },
];

function decodeXML(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function parseYouTubeRSS(xml, tag) {
  const videos = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const e = m[1];
    const videoId   = (e.match(/<yt:videoId>(.*?)<\/yt:videoId>/)          || [])[1] || '';
    const rawTitle  = (e.match(/<media:title[^>]*>([\s\S]*?)<\/media:title>/) ||
                       e.match(/<title>([\s\S]*?)<\/title>/)                   || [])[1] || '';
    const channel   = (e.match(/<author>[\s\S]*?<name>(.*?)<\/name>/)       || [])[1] || '';
    const published = (e.match(/<published>(.*?)<\/published>/)              || [])[1] || '';
    const thumb     = (e.match(/<media:thumbnail[^>]*url="([^"]+)"/)        || [])[1]
                   || (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : '');
    if (videoId && rawTitle) {
      videos.push({
        id:        videoId,
        tag,
        title:     decodeXML(rawTitle),
        thumb,
        channel:   decodeXML(channel),
        published,
      });
    }
  }
  return videos;
}

async function fetchRSSFallback() {
  const results = await Promise.all(RSS_FEEDS.map(async ({ url, tag }) => {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Sideline/1.0; +https://fantakes.app)' },
      });
      if (!r.ok) return [];
      return parseYouTubeRSS(await r.text(), tag);
    } catch { return []; }
  }));
  return results.flat();
}

const CHANNELS = {
  all:      ['UCDVYQ4Zhbm3S2dlz7P1GBDg','UCEjOSbbaOfgnfRODEEMYlCw','UCoLrcjPV5PbUrUyXq5mjc_A','UCqZQlzSHbVJrwrn5XvzrzcA','UCznv__14nznPLH1T2YMDbhA','UCvgfXK4nTYKudb0rFR6noSQ','UCB_qr75-ydFVKSF9Dmo6izg','UCB-3oiAkRKvMQbVQkjD_f5A','UCW-QMcKMSMBHlTj0SVFdNrQ','UCpcTrCXblq78Gn28FGMocqQ'],
  american: ['UCDVYQ4Zhbm3S2dlz7P1GBDg','UCEjOSbbaOfgnfRODEEMYlCw','UCoLrcjPV5PbUrUyXq5mjc_A','UCB-3oiAkRKvMQbVQkjD_f5A'],
  soccer:   ['UCqZQlzSHbVJrwrn5XvzrzcA','UCW-QMcKMSMBHlTj0SVFdNrQ','UCpcTrCXblq78Gn28FGMocqQ','UCsb5wjy_TfzfUMDFECDaADQ','UC8ZpZgeEVHCMn9PfnOyEhAA'],
  rugby:    ['UCznv__14nznPLH1T2YMDbhA'],
  combat:   ['UCvgfXK4nTYKudb0rFR6noSQ'],
  racing:   ['UCB_qr75-ydFVKSF9Dmo6izg'],
};

const TAGS = {
  'UCDVYQ4Zhbm3S2dlz7P1GBDg': 'NFL',
  'UCEjOSbbaOfgnfRODEEMYlCw': 'NBA',
  'UCoLrcjPV5PbUrUyXq5mjc_A': 'MLB',
  'UCqZQlzSHbVJrwrn5XvzrzcA': 'EPL',
  'UCznv__14nznPLH1T2YMDbhA': 'Rugby',
  'UCvgfXK4nTYKudb0rFR6noSQ': 'UFC',
  'UCB_qr75-ydFVKSF9Dmo6izg': 'F1',
  'UCB-3oiAkRKvMQbVQkjD_f5A': 'NHL',
  'UCW-QMcKMSMBHlTj0SVFdNrQ': 'MLS',
  'UCpcTrCXblq78Gn28FGMocqQ': 'UCL',
  'UCsb5wjy_TfzfUMDFECDaADQ': 'La Liga',
  'UC8ZpZgeEVHCMn9PfnOyEhAA': 'Soccer',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.', videos: [] });
  }

  const sport = req.query.sport || 'all';

  // Serve from in-memory cache if still warm (2-hour TTL)
  const cached = videoCache.get(sport);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.setHeader('X-Video-Source', cached.source);
    return res.status(200).json({ videos: cached.videos, source: cached.source });
  }

  const YT_KEY = process.env.YOUTUBE_API_KEY;
  let videos = [];
  let source = 'rss';

  // ── Try YouTube Data API first ──────────────────────────────────────────
  if (YT_KEY) {
    try {
      const channels = CHANNELS[sport] || CHANNELS['all'];
      const results = await Promise.all(channels.map(async id => {
        try {
          const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${id}&maxResults=4&order=date&type=video&key=${YT_KEY}`;
          const r = await fetch(url);
          if (!r.ok) return []; // 403 quota exceeded, 429 rate limit, etc.
          const d = await r.json();
          if (d.error) return []; // API-level error (quota, invalid key)
          return (d.items || [])
            .filter(item => item.id?.videoId)
            .map(item => ({
              id:        item.id.videoId,
              tag:       TAGS[id] || 'Sports',
              title:     item.snippet.title,
              thumb:     item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
              channel:   item.snippet.channelTitle,
              published: item.snippet.publishedAt,
            }));
        } catch { return []; }
      }));
      videos = results.flat();
      if (videos.length) source = 'api';
    } catch { /* fall through to RSS */ }
  }

  // ── RSS fallback: used when API is unconfigured, quota-exceeded, or errored ──
  if (!videos.length) {
    videos = await fetchRSSFallback();
    source = 'rss';
  }

  // Cache result for 2 hours (prevents quota drain across warm instances)
  if (videos.length) {
    videoCache.set(sport, { videos, ts: Date.now(), source });
  }

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
  res.setHeader('X-Video-Source', source);
  return res.status(200).json({ videos, source });
}
