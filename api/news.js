import { checkRateLimit, getClientIP } from './_ratelimit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const ip = getClientIP(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.', articles: [] });
  }

  const sport = req.query.sport || 'home';

  // Free public RSS feeds — no API key, no domain restrictions
  // BBC Sport for rugby/combat/racing/soccer, ESPN for American sports
  const RSS_URLS = {
    home:     ['https://feeds.bbci.co.uk/sport/rss.xml',
               'https://www.espn.com/espn/rss/news'],
    american: ['https://www.espn.com/espn/rss/nfl/news',
               'https://www.espn.com/espn/rss/nba/news',
               'https://feeds.bbci.co.uk/sport/american-football/rss.xml'],
    soccer:   ['https://feeds.bbci.co.uk/sport/football/rss.xml',
               'https://www.espn.com/espn/rss/soccer/news'],
    rugby:    ['https://feeds.bbci.co.uk/sport/rugby-union/rss.xml',
               'https://feeds.bbci.co.uk/sport/rugby-league/rss.xml'],
    combat:   ['https://feeds.bbci.co.uk/sport/boxing/rss.xml',
               'https://feeds.bbci.co.uk/sport/mixed-martial-arts/rss.xml'],
    racing:   ['https://feeds.bbci.co.uk/sport/formula1/rss.xml'],
    nfl:      ['https://www.espn.com/espn/rss/nfl/news',
               'https://feeds.bbci.co.uk/sport/american-football/rss.xml'],
    nba:      ['https://www.espn.com/espn/rss/nba/news'],
    mlb:      ['https://www.espn.com/espn/rss/mlb/news'],
    nhl:      ['https://www.espn.com/espn/rss/nhl/news'],
  };

  // Source name by domain
  function sourceName(url) {
    if (url.includes('bbc')) return 'BBC Sport';
    if (url.includes('espn')) return 'ESPN';
    return 'Sports';
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

  function clean(s) {
    return s
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function parseRSS(xml, src) {
    const items = [];
    const re = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const item = m[1];
      const title = clean(extractTag(item, 'title'));
      const link  = extractTag(item, 'link')
                 || extractAttr(item, 'link', 'href')
                 || extractAttr(item, 'atom:link', 'href');
      const desc  = clean(extractTag(item, 'description'));
      const pub   = extractTag(item, 'pubDate');
      const image = extractAttr(item, 'media:thumbnail', 'url')
                 || extractAttr(item, 'media:content', 'url')
                 || extractAttr(item, 'enclosure', 'url')
                 || '';
      if (title && link) {
        items.push({
          title,
          url:         link.trim(),
          description: desc.slice(0, 200),
          image,
          source:      src,
          publishedAt: pub ? new Date(pub).toISOString() : new Date().toISOString(),
        });
      }
    }
    return items;
  }

  try {
    const urls = RSS_URLS[sport] || RSS_URLS['home'];
    const results = await Promise.all(urls.map(async url => {
      try {
        const r = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Sideline/1.0; +https://fantakes.app)',
            'Accept': 'application/rss+xml, application/xml, text/xml',
          },
        });
        if (!r.ok) return [];
        return parseRSS(await r.text(), sourceName(url));
      } catch { return []; }
    }));

    const articles = results.flat().slice(0, 20);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ articles });
  } catch (err) {
    return res.status(200).json({ articles: [], error: err.message });
  }
}
