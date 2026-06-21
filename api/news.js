export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NEWS_KEY = process.env.NEWS_API_KEY;
  const sport = req.query.sport || 'sports';

  const QUERIES = {
    home:     'NFL OR NBA OR MLB OR soccer OR UFC OR F1 sports highlights',
    american: 'NFL OR NBA OR MLB OR NHL OR basketball OR football',
    soccer:   'Premier League OR La Liga OR Champions League OR MLS OR soccer',
    rugby:    'rugby union OR rugby league OR Six Nations OR All Blacks',
    combat:   'UFC OR MMA OR boxing OR fighting',
    racing:   'Formula 1 OR F1 OR NASCAR OR IndyCar OR racing',
  };

  if (!NEWS_KEY) {
    return res.status(500).json({ error: 'News API key not configured', articles: [] });
  }

  try {
    const q = QUERIES[sport] || sport;
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=12&apiKey=${NEWS_KEY}`;
    const r = await fetch(url);
    const d = await r.json();

    if (d.status !== 'ok') {
      return res.status(500).json({ error: d.message, articles: [] });
    }

    const articles = (d.articles || [])
      .filter(a => a.title && a.title !== '[Removed]' && a.urlToImage)
      .slice(0, 12)
      .map(a => ({
        title: a.title,
        description: a.description,
        url: a.url,
        urlToImage: a.urlToImage,
        source: a.source?.name || 'News',
        publishedAt: a.publishedAt,
      }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ articles });
  } catch (err) {
    return res.status(500).json({ error: err.message, articles: [] });
  }
}
