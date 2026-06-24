import { checkRateLimit, getClientIP } from './_ratelimit.js';

const freshCache = new Map(); // sport -> { articles, sources_used, ts }
const lastGood   = new Map(); // persistent fallback, never expires
const CACHE_TTL  = 5 * 60 * 1000;

// ── Deduplication ──────────────────────────────────────────────────────────
const STOP = new Set(['the','a','an','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','can','in','on','at','by','for','with','about','into','from','up','out','over','under','then','when','where','how','all','both','each','more','some','no','not','only','so','than','too','very','just','but','if','or','and','as','of','its','it','this','that','he','she','they','we','you','his','her','their','our','to','vs','after','says','said']);

function keywords(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
}

function isDup(a, b) {
  const s = new Set(keywords(a.title));
  return keywords(b.title).filter(w => s.has(w)).length >= 4;
}

function dedupe(articles) {
  const out = [];
  for (const art of articles) {
    const idx = out.findIndex(u => isDup(u, art));
    if (idx === -1) {
      out.push(art);
    } else {
      out[idx].trending = true; // same story from 2+ sources = trending
      // Prefer the version with a real image
      if (!out[idx].image && art.image) Object.assign(out[idx], art, { trending: true });
    }
  }
  return out;
}

// ── RSS parsing ────────────────────────────────────────────────────────────
function clean(s) {
  return s.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

function extractAttr(xml, tag, attr) {
  const t = tag.replace(':', '\\:');
  const m = xml.match(new RegExp(`<${t}[^>]*\\s${attr}="([^"]+)"`));
  return m ? m[1] : '';
}

const EXCLUSIVE_SOURCES = new Set(['The Guardian','Bleacher Report','Sky Sports','CBS Sports']);

function parseRSS(xml, sourceName, fallbackImage) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const item = m[1];
    const title   = clean(extractTag(item, 'title'));
    const link    = extractTag(item, 'link') || extractAttr(item, 'link', 'href') || extractAttr(item, 'atom:link', 'href');
    const rawDesc = extractTag(item, 'description');
    const desc    = clean(rawDesc).slice(0, 200);
    const pub     = extractTag(item, 'pubDate');
    // Image: try media tags, then embedded <img> in description HTML, then sport fallback
    const image   = extractAttr(item, 'media:thumbnail', 'url')
                 || extractAttr(item, 'media:content', 'url')
                 || extractAttr(item, 'enclosure', 'url')
                 || (rawDesc.match(/<img[^>]+src="([^"]+)"/) || [])[1]
                 || fallbackImage
                 || '';
    if (title && link) {
      const publishedAt = pub ? new Date(pub).toISOString() : new Date().toISOString();
      items.push({
        title, url: link.trim(), description: desc, image,
        source:    sourceName,
        publishedAt,
        breaking:  Date.now() - new Date(publishedAt).getTime() < 2 * 60 * 60 * 1000,
        exclusive: EXCLUSIVE_SOURCES.has(sourceName),
        trending:  false,
      });
    }
  }
  return items;
}

async function fetchRSS({ url, name, fallbackImage }) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Sideline/1.0; +https://fantakes.app)',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseRSS(await r.text(), name, fallbackImage);
}

// ── Sport fallback images ──────────────────────────────────────────────────
const IMG = {
  american: 'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&q=80',
  soccer:   'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80',
  rugby:    'https://images.unsplash.com/photo-1544551763-92ab472cad5d?w=800&q=80',
  combat:   'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80',
  racing:   'https://images.unsplash.com/photo-1541773367336-d3f401acbb7a?w=800&q=80',
  default:  'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
};

// ── Source registry ────────────────────────────────────────────────────────
const SOURCES = {
  home: [
    { url: 'https://feeds.bbci.co.uk/sport/rss.xml',          name: 'BBC Sport',       fallbackImage: IMG.default },
    { url: 'https://www.espn.com/espn/rss/news',               name: 'ESPN',            fallbackImage: IMG.default },
    { url: 'https://www.theguardian.com/sport/rss',            name: 'The Guardian',    fallbackImage: IMG.default },
    { url: 'https://www.skysports.com/rss/12040',              name: 'Sky Sports',      fallbackImage: IMG.default },
    { url: 'https://www.cbssports.com/rss/headlines',          name: 'CBS Sports',      fallbackImage: IMG.default },
    { url: 'http://bleacherreport.com/articles/feed',          name: 'Bleacher Report', fallbackImage: IMG.default },
  ],
  american: [
    { url: 'https://www.espn.com/espn/rss/nfl/news',           name: 'ESPN NFL',        fallbackImage: IMG.american },
    { url: 'https://www.espn.com/espn/rss/nba/news',           name: 'ESPN NBA',        fallbackImage: IMG.american },
    { url: 'https://www.espn.com/espn/rss/mlb/news',           name: 'ESPN MLB',        fallbackImage: IMG.american },
    { url: 'https://www.espn.com/espn/rss/nhl/news',           name: 'ESPN NHL',        fallbackImage: IMG.american },
    { url: 'https://feeds.bbci.co.uk/sport/american-football/rss.xml', name: 'BBC Sport', fallbackImage: IMG.american },
    { url: 'https://www.cbssports.com/nfl/rss/headlines',      name: 'CBS Sports',      fallbackImage: IMG.american },
  ],
  soccer: [
    { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',  name: 'BBC Sport',      fallbackImage: IMG.soccer },
    { url: 'https://www.espn.com/espn/rss/soccer/news',         name: 'ESPN',           fallbackImage: IMG.soccer },
    { url: 'https://www.theguardian.com/football/rss',          name: 'The Guardian',   fallbackImage: IMG.soccer },
    { url: 'https://www.skysports.com/rss/12040',               name: 'Sky Sports',     fallbackImage: IMG.soccer },
  ],
  rugby: [
    { url: 'https://feeds.bbci.co.uk/sport/rugby-union/rss.xml',  name: 'BBC Sport',   fallbackImage: IMG.rugby },
    { url: 'https://feeds.bbci.co.uk/sport/rugby-league/rss.xml', name: 'BBC Sport',   fallbackImage: IMG.rugby },
    { url: 'https://www.theguardian.com/sport/rugby-union/rss',   name: 'The Guardian',fallbackImage: IMG.rugby },
  ],
  combat: [
    { url: 'https://feeds.bbci.co.uk/sport/boxing/rss.xml',           name: 'BBC Sport', fallbackImage: IMG.combat },
    { url: 'https://feeds.bbci.co.uk/sport/mixed-martial-arts/rss.xml', name: 'BBC Sport', fallbackImage: IMG.combat },
  ],
  racing: [
    { url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml',  name: 'BBC Sport',      fallbackImage: IMG.racing },
    { url: 'https://www.theguardian.com/sport/formulaone/rss',  name: 'The Guardian',  fallbackImage: IMG.racing },
  ],
  nfl: [
    { url: 'https://www.espn.com/espn/rss/nfl/news',            name: 'ESPN NFL',       fallbackImage: IMG.american },
    { url: 'https://feeds.bbci.co.uk/sport/american-football/rss.xml', name: 'BBC Sport', fallbackImage: IMG.american },
    { url: 'https://www.cbssports.com/nfl/rss/headlines',       name: 'CBS Sports',     fallbackImage: IMG.american },
  ],
  nba: [
    { url: 'https://www.espn.com/espn/rss/nba/news',            name: 'ESPN NBA',       fallbackImage: IMG.american },
    { url: 'https://www.cbssports.com/nba/rss/headlines',       name: 'CBS Sports',     fallbackImage: IMG.american },
  ],
  mlb: [
    { url: 'https://www.espn.com/espn/rss/mlb/news',            name: 'ESPN MLB',       fallbackImage: IMG.american },
    { url: 'https://www.cbssports.com/mlb/rss/headlines',       name: 'CBS Sports',     fallbackImage: IMG.american },
  ],
  nhl: [
    { url: 'https://www.espn.com/espn/rss/nhl/news',            name: 'ESPN NHL',       fallbackImage: IMG.american },
    { url: 'https://www.cbssports.com/nhl/rss/headlines',       name: 'CBS Sports',     fallbackImage: IMG.american },
  ],
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded', articles: [] });
  }

  const sport = req.query.sport || 'home';

  // 5-min cache
  const cached = freshCache.get(sport);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ articles: cached.articles, sources_used: cached.sources_used, source: 'cache' });
  }

  const sources = SOURCES[sport] || SOURCES.home;

  // ── LAYER 2: fetch ALL sources simultaneously ──────────────────────────
  const settled = await Promise.allSettled(sources.map(s => fetchRSS(s)));

  const activeSourceNames = [];
  let all = [];
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value.length) {
      all = all.concat(r.value);
      if (r.value[0]?.source) activeSourceNames.push(r.value[0].source);
    }
  }

  // ── LAYER 3: gap finder — if sport-specific sources all failed, pull from home ──
  if (!all.length && sport !== 'home') {
    const homeSettled = await Promise.allSettled(SOURCES.home.map(s => fetchRSS(s)));
    for (const r of homeSettled) {
      if (r.status === 'fulfilled' && r.value.length) all = all.concat(r.value);
    }
  }

  // Deduplicate (4+ shared keywords = same story; marks duplicates as trending)
  const deduped = dedupe(all);

  // Sort newest first
  deduped.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const articles = deduped.slice(0, 30);

  if (articles.length) {
    const payload = { articles, sources_used: activeSourceNames.length, source: 'live' };
    freshCache.set(sport, { ...payload, ts: Date.now() });
    lastGood.set(sport, { ...payload, ts: Date.now() });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(payload);
  }

  // Last-good fallback if every source failed
  const fallback = lastGood.get(sport);
  if (fallback) {
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({ ...fallback, source: 'fallback' });
  }

  return res.status(200).json({ articles: [], sources_used: 0, source: 'empty' });
}
