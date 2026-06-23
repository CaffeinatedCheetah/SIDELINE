export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const sport = req.query.sport || 'home';
  const NEWS_KEY = 'fa4847ed84614698b66c937a10a28c83';

  const SPORT_QUERIES = {
    home:     'sports NFL NBA soccer UFC "Formula 1" highlights',
    american: 'NFL OR NBA OR MLB OR NHL basketball football',
    soccer:   '"World Cup" OR "Premier League" OR "Champions League" OR "soccer transfer" OR Messi OR Ronaldo OR "La Liga"',
    rugby:    '"rugby union" OR "rugby league" OR "Six Nations" OR "Super Rugby" OR "All Blacks"',
    combat:   'UFC OR MMA OR boxing OR "fight night" OR "title fight"',
    racing:   '"Formula 1" OR F1 OR NASCAR OR IndyCar OR "MotoGP"',
    nfl:      'NFL football',
    nba:      'NBA basketball',
    mlb:      'MLB baseball',
    nhl:      'NHL hockey',
    ufc:      'UFC MMA fight',
    f1:       '"Formula 1" F1 grand prix',
  };

  const query = SPORT_QUERIES[sport] || sport;

  try {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWS_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'ok') {
      return res.status(500).json({ error: data.message });
    }

    const articles = (data.articles || [])
      .filter(a => a.title && a.title !== '[Removed]' && a.urlToImage)
      .slice(0, 20)
      .map(a => ({
        title:       a.title,
        description: a.description,
        url:         a.url,
        image:       a.urlToImage,
        source:      a.source?.name || 'News',
        publishedAt: a.publishedAt,
      }));

    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({ articles });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
