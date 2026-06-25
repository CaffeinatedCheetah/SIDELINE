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
  const m = xml.match(new RegExp(`<${t}[^>]*\\s${attr}="([^"]+)"`))
         || xml.match(new RegExp(`<${t}[^>]*${attr}="([^"]+)"`));
  return m ? m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>') : '';
}

const EXCLUSIVE_SOURCES = new Set(['The Guardian','Sky Sports','Sports Illustrated','Sporting News','90min']);

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
    const fbImg = Array.isArray(fallbackImage) ? pickImg(fallbackImage, title + link) : (fallbackImage || '');
    const encUrl = extractAttr(item, 'enclosure', 'url');
    const encType = extractAttr(item, 'enclosure', 'type');
    const descImg = (rawDesc.match(/<img[^>]+src="([^"]+)"/) || [])[1] || '';
    const image   = extractAttr(item, 'media:content', 'url')
                 || extractAttr(item, 'media:thumbnail', 'url')
                 || (encUrl && (!encType || encType.startsWith('image')) ? encUrl : '')
                 || (descImg && descImg.startsWith('http') ? descImg : '')
                 || fbImg;
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

// ── Sport fallback image pools ─────────────────────────────────────────────
const IMG_POOLS = {
  american: [
    'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&q=80',
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80',
    'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=800&q=80',
    'https://images.unsplash.com/photo-1598136490941-30d885318abd?w=800&q=80',
    'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800&q=80',
    'https://images.unsplash.com/photo-1515703407324-5f753afd8be8?w=800&q=80',
    'https://images.unsplash.com/photo-1574623452334-1e0ac2b3ccb4?w=800&q=80',
    'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&q=80',
    'https://images.unsplash.com/photo-1521941651707-748bdbae77e7?w=800&q=80',
    'https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?w=800&q=80',
    'https://images.unsplash.com/photo-1471295253337-3ceaaedca402?w=800&q=80',
    'https://images.unsplash.com/photo-1590080875852-5fe4f3c7f2e7?w=800&q=80',
  ],
  soccer: [
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80',
    'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80',
    'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=800&q=80',
    'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=800&q=80',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800&q=80',
    'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80',
    'https://images.unsplash.com/photo-1540747913346-19212a4b423a?w=800&q=80',
    'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800&q=80',
    'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=800&q=80',
  ],
  rugby: [
    'https://images.unsplash.com/photo-1544551763-92ab472cad5d?w=800&q=80',
    'https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=800&q=80',
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80',
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80',
    'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80',
  ],
  combat: [
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80',
    'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80',
    'https://images.unsplash.com/photo-1517438322307-e67111335449?w=800&q=80',
    'https://images.unsplash.com/photo-1544919982-b61976f0ba43?w=800&q=80',
    'https://images.unsplash.com/photo-1529516548873-9ce57c8f155e?w=800&q=80',
    'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=800&q=80',
  ],
  racing: [
    'https://images.unsplash.com/photo-1541773367336-d3f401acbb7a?w=800&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800&q=80',
    'https://images.unsplash.com/photo-1594394797451-d1f75c69a3d8?w=800&q=80',
    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80',
    'https://images.unsplash.com/photo-1616788494707-ec28f08d05a1?w=800&q=80',
  ],
  default: [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&q=80',
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80',
    'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80',
    'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=800&q=80',
    'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&q=80',
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80',
    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&q=80',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80',
    'https://images.unsplash.com/photo-1541773367336-d3f401acbb7a?w=800&q=80',
    'https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=800&q=80',
  ],
};

function pickImg(pool, seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  return pool[h % pool.length];
}

// ── Source registry ────────────────────────────────────────────────────────
const SOURCES = {
  home: [
    { url: 'https://feeds.bbci.co.uk/sport/rss.xml',                  name: 'BBC Sport',         fallbackImage: IMG_POOLS.default},
    { url: 'https://www.espn.com/espn/rss/news',                       name: 'ESPN',              fallbackImage: IMG_POOLS.default},
    { url: 'https://www.theguardian.com/sport/rss',                    name: 'The Guardian',      fallbackImage: IMG_POOLS.default},
    { url: 'https://www.skysports.com/rss/12040',                      name: 'Sky Sports',        fallbackImage: IMG_POOLS.default},
    { url: 'https://www.cbssports.com/rss/headlines/',                 name: 'CBS Sports',        fallbackImage: IMG_POOLS.default},
    { url: 'https://feeds.bleacherreport.com/articles/home.rss',       name: 'Bleacher Report',   fallbackImage: IMG_POOLS.default},
    { url: 'https://api.foxsports.com/v1/rss',                         name: 'Fox Sports',        fallbackImage: IMG_POOLS.default},
    { url: 'https://www.si.com/rss/si_topstories.rss',                 name: 'Sports Illustrated',fallbackImage: IMG_POOLS.default},
    { url: 'https://sports.yahoo.com/rss/',                            name: 'Yahoo Sports',      fallbackImage: IMG_POOLS.default},
    { url: 'https://www.sportingnews.com/us/rss',                      name: 'Sporting News',     fallbackImage: IMG_POOLS.default},
  ],
  american: [
    { url: 'https://www.espn.com/espn/rss/nfl/news',                   name: 'ESPN NFL',          fallbackImage: IMG_POOLS.american },
    { url: 'https://www.espn.com/espn/rss/nba/news',                   name: 'ESPN NBA',          fallbackImage: IMG_POOLS.american },
    { url: 'https://www.espn.com/espn/rss/mlb/news',                   name: 'ESPN MLB',          fallbackImage: IMG_POOLS.american },
    { url: 'https://www.espn.com/espn/rss/nhl/news',                   name: 'ESPN NHL',          fallbackImage: IMG_POOLS.american },
    { url: 'https://feeds.bbci.co.uk/sport/american-football/rss.xml', name: 'BBC Sport',         fallbackImage: IMG_POOLS.american },
    { url: 'https://www.cbssports.com/nfl/rss/headlines/',             name: 'CBS Sports',        fallbackImage: IMG_POOLS.american },
    { url: 'https://feeds.bleacherreport.com/articles/home.rss',       name: 'Bleacher Report',   fallbackImage: IMG_POOLS.american },
    { url: 'https://api.foxsports.com/v1/rss',                         name: 'Fox Sports',        fallbackImage: IMG_POOLS.american },
  ],
  soccer: [
    { url: 'https://feeds.bbci.co.uk/sport/football/rss.xml',          name: 'BBC Sport',         fallbackImage: IMG_POOLS.soccer },
    { url: 'https://www.espn.com/espn/rss/soccer/news',                name: 'ESPN',              fallbackImage: IMG_POOLS.soccer },
    { url: 'https://www.theguardian.com/football/rss',                 name: 'The Guardian',      fallbackImage: IMG_POOLS.soccer },
    { url: 'https://www.skysports.com/rss/12040',                      name: 'Sky Sports',        fallbackImage: IMG_POOLS.soccer },
    { url: 'https://www.90min.com/feed',                               name: '90min',             fallbackImage: IMG_POOLS.soccer },
    { url: 'https://www.sportingnews.com/us/rss',                      name: 'Sporting News',     fallbackImage: IMG_POOLS.soccer },
  ],
  rugby: [
    { url: 'https://feeds.bbci.co.uk/sport/rugby-union/rss.xml',       name: 'BBC Sport',         fallbackImage: IMG_POOLS.rugby },
    { url: 'https://feeds.bbci.co.uk/sport/rugby-league/rss.xml',      name: 'BBC Sport',         fallbackImage: IMG_POOLS.rugby },
    { url: 'https://www.theguardian.com/sport/rugby-union/rss',        name: 'The Guardian',      fallbackImage: IMG_POOLS.rugby },
  ],
  combat: [
    { url: 'https://feeds.bbci.co.uk/sport/boxing/rss.xml',            name: 'BBC Sport',         fallbackImage: IMG_POOLS.combat },
    { url: 'https://feeds.bbci.co.uk/sport/mixed-martial-arts/rss.xml',name: 'BBC Sport',         fallbackImage: IMG_POOLS.combat },
    { url: 'https://www.cbssports.com/mma/rss/headlines/',             name: 'CBS Sports',        fallbackImage: IMG_POOLS.combat },
  ],
  racing: [
    { url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml',          name: 'BBC Sport',         fallbackImage: IMG_POOLS.racing },
    { url: 'https://www.theguardian.com/sport/formulaone/rss',         name: 'The Guardian',      fallbackImage: IMG_POOLS.racing },
  ],
  nfl: [
    { url: 'https://www.espn.com/espn/rss/nfl/news',            name: 'ESPN NFL',       fallbackImage: IMG_POOLS.american },
    { url: 'https://feeds.bbci.co.uk/sport/american-football/rss.xml', name: 'BBC Sport', fallbackImage: IMG_POOLS.american },
    { url: 'https://www.cbssports.com/nfl/rss/headlines',       name: 'CBS Sports',     fallbackImage: IMG_POOLS.american },
  ],
  nba: [
    { url: 'https://www.espn.com/espn/rss/nba/news',            name: 'ESPN NBA',       fallbackImage: IMG_POOLS.american },
    { url: 'https://www.cbssports.com/nba/rss/headlines',       name: 'CBS Sports',     fallbackImage: IMG_POOLS.american },
  ],
  mlb: [
    { url: 'https://www.espn.com/espn/rss/mlb/news',            name: 'ESPN MLB',       fallbackImage: IMG_POOLS.american },
    { url: 'https://www.cbssports.com/mlb/rss/headlines',       name: 'CBS Sports',     fallbackImage: IMG_POOLS.american },
  ],
  nhl: [
    { url: 'https://www.espn.com/espn/rss/nhl/news',            name: 'ESPN NHL',       fallbackImage: IMG_POOLS.american },
    { url: 'https://www.cbssports.com/nhl/rss/headlines',       name: 'CBS Sports',     fallbackImage: IMG_POOLS.american },
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

  // Fix duplicate images: if same URL used by >2 articles, replace with unique per-article fallback
  const imgCount = {};
  for (const a of deduped) { if (a.image) imgCount[a.image] = (imgCount[a.image] || 0) + 1; }
  const sportPool = sport === 'soccer' ? IMG_POOLS.soccer
                  : sport === 'rugby'   ? IMG_POOLS.rugby
                  : sport === 'combat'  ? IMG_POOLS.combat
                  : sport === 'racing'  ? IMG_POOLS.racing
                  : IMG_POOLS.american;
  for (const a of deduped) {
    if (a.image && imgCount[a.image] > 2) {
      a.image = pickImg(sportPool, a.title + a.url + a.publishedAt);
    }
  }

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
